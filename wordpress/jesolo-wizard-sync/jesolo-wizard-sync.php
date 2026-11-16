<?php
/**
 * Plugin Name:       Jesolo Wizard Sync
 * Description:       Invia ogni 3 giorni eventi, attività, impianti sportivi, percorsi bici e pagine di questo sito al Wizard di Jesolo (Supabase).
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Jesolo Media House
 * License:           GPL-2.0-or-later
 * Text Domain:       jesolo-wizard-sync
 *
 * How it works: the data is read inside WordPress (internal REST requests and
 * WP_Query, no HTTP calls to this site) and POSTed to the Supabase Edge
 * Function `sync-jesolo-data` with the header `x-wizard-sync-key`. Requests go
 * out from this server, so the host's anti-bot protection is not involved.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Jesolo_Wizard_Sync {

	const OPTION        = 'jws_settings';
	const LAST_RUN      = 'jws_last_run';
	const CRON_HOOK     = 'jws_run_sync';
	const CRON_SCHEDULE = 'jws_every_three_days';
	const DEFAULT_URL   = 'https://gdxyjdggxtrhvieqtoct.supabase.co/functions/v1/sync-jesolo-data';
	// Max JSON size of one request; larger sources are split in batches.
	const MAX_BATCH_BYTES = 1500000;

	public static function init() {
		add_filter( 'cron_schedules', array( __CLASS__, 'cron_schedules' ) );
		add_action( self::CRON_HOOK, array( __CLASS__, 'run_sync' ) );
		add_action( 'admin_menu', array( __CLASS__, 'admin_menu' ) );
		add_action( 'admin_post_jws_save', array( __CLASS__, 'handle_save' ) );
		add_action( 'admin_post_jws_sync_now', array( __CLASS__, 'handle_sync_now' ) );
		add_action( 'admin_post_jws_test', array( __CLASS__, 'handle_test' ) );
		add_action( 'admin_post_jws_new_key', array( __CLASS__, 'handle_new_key' ) );
	}

	/* ---------------------------------------------------------------------
	 * Activation, settings, schedule
	 * ------------------------------------------------------------------- */

	public static function activate() {
		$settings = self::settings();
		if ( empty( $settings['key'] ) ) {
			$settings['key'] = self::generate_key();
		}
		update_option( self::OPTION, $settings, false );
		self::cron_schedules_register();
		if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
			// First run in 10 minutes, then every 3 days.
			wp_schedule_event( time() + 10 * MINUTE_IN_SECONDS, self::CRON_SCHEDULE, self::CRON_HOOK );
		}
	}

	public static function deactivate() {
		wp_clear_scheduled_hook( self::CRON_HOOK );
	}

	private static function cron_schedules_register() {
		add_filter( 'cron_schedules', array( __CLASS__, 'cron_schedules' ) );
	}

	public static function cron_schedules( $schedules ) {
		$schedules[ self::CRON_SCHEDULE ] = array(
			'interval' => 3 * DAY_IN_SECONDS,
			'display'  => 'Ogni 3 giorni (Jesolo Wizard Sync)',
		);
		return $schedules;
	}

	private static function generate_key() {
		return wp_generate_password( 48, false, false );
	}

	public static function settings() {
		$defaults = array(
			'endpoint'      => self::DEFAULT_URL,
			'key'           => '',
			'exclude_slugs' => "privacy-policy\ncookie-policy",
			'bike_parent'   => 1963,
		);
		$saved = get_option( self::OPTION, array() );
		return array_merge( $defaults, is_array( $saved ) ? $saved : array() );
	}

	/* ---------------------------------------------------------------------
	 * Sync
	 * ------------------------------------------------------------------- */

	/**
	 * Collects every source and sends it. Returns a per-source report.
	 */
	public static function run_sync() {
		if ( function_exists( 'set_time_limit' ) ) {
			@set_time_limit( 300 ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
		}
		$settings    = self::settings();
		$run_started = gmdate( 'c' );
		$report      = array();

		// Read as an anonymous visitor: only public content is sent.
		$previous_user = get_current_user_id();
		wp_set_current_user( 0 );

		$sources = array(
			'tribe_categories'     => function () {
				return self::rest_collect( '/tribe/events/v1/categories', array(), false, 'categories', 100 );
			},
			'tribe_events'         => function () {
				return self::rest_collect( '/tribe/events/v1/events', array( 'start_date' => gmdate( 'Y-m-d' ) ), false, 'events', 50 );
			},
			'sports_categories'    => function () {
				return self::terms( 'categoria_strutture_sportive' );
			},
			'sports_facilities'    => function () {
				return self::rest_collect( '/wp/v2/strutture_sportive', array(), true );
			},
			'activity_categories'  => function () {
				return self::terms( 'attivita-jesolo-category' );
			},
			'activities'           => function () {
				return self::rest_collect( '/wp/v2/attivita-jesolo', array(), true );
			},
			'bike_pages'           => function () use ( $settings ) {
				return self::rest_collect( '/wp/v2/pages', array( 'parent' => (int) $settings['bike_parent'] ), true );
			},
			'beach_establishments' => function () {
				return self::rest_collect( '/wp/v2/stabilimenti', array(), true );
			},
		);

		foreach ( $sources as $kind => $collect ) {
			$items = $collect();
			if ( is_wp_error( $items ) ) {
				$report[ $kind ] = array( 'ok' => false, 'message' => $items->get_error_message() );
				continue;
			}
			$report[ $kind ] = self::send_batches( $kind, $items, $run_started );
		}

		$pages            = self::collect_pages( $settings );
		$report['pages'] = self::send_batches( 'pages', $pages, $run_started, true );

		wp_set_current_user( $previous_user );

		update_option(
			self::LAST_RUN,
			array(
				'time'   => time(),
				'report' => $report,
			),
			false
		);
		return $report;
	}

	/**
	 * Internal REST request (no HTTP), paginated. Returns the items array or WP_Error.
	 */
	private static function rest_collect( $route, $params, $embed, $list_key = null, $per_page = 50, $max_pages = 50 ) {
		$all = array();
		for ( $page = 1; $page <= $max_pages; $page++ ) {
			$request = new WP_REST_Request( 'GET', $route );
			foreach ( array_merge( $params, array( 'per_page' => $per_page, 'page' => $page ) ) as $k => $v ) {
				$request->set_param( $k, $v );
			}
			$response = rest_do_request( $request );
			if ( $response->is_error() ) {
				if ( 1 === $page ) {
					$error = $response->as_error();
					return new WP_Error( 'jws_rest', $route . ': ' . $error->get_error_message() );
				}
				break; // past the last page
			}
			$data  = rest_get_server()->response_to_data( $response, $embed );
			$items = $list_key ? ( isset( $data[ $list_key ] ) ? $data[ $list_key ] : array() ) : $data;
			if ( ! is_array( $items ) || ! $items ) {
				break;
			}
			$all = array_merge( $all, $items );
			if ( count( $items ) < $per_page ) {
				break;
			}
		}
		return $all;
	}

	/**
	 * Taxonomy terms as { id, name, slug } (works even when the taxonomy has no REST route).
	 */
	private static function terms( $taxonomy ) {
		if ( ! taxonomy_exists( $taxonomy ) ) {
			return new WP_Error( 'jws_taxonomy', 'Tassonomia non trovata: ' . $taxonomy );
		}
		$terms = get_terms(
			array(
				'taxonomy'   => $taxonomy,
				'hide_empty' => false,
			)
		);
		if ( is_wp_error( $terms ) ) {
			return $terms;
		}
		return array_map(
			function ( $t ) {
				return array(
					'id'   => (int) $t->term_id,
					'name' => html_entity_decode( $t->name, ENT_QUOTES, 'UTF-8' ),
					'slug' => $t->slug,
				);
			},
			$terms
		);
	}

	/**
	 * Published pages (all languages when WPML/Polylang are active), with rendered content.
	 */
	private static function collect_pages( $settings ) {
		$excluded = array_filter( array_map( 'trim', explode( "\n", (string) $settings['exclude_slugs'] ) ) );
		$query    = new WP_Query(
			array(
				'post_type'        => 'page',
				'post_status'      => 'publish',
				'posts_per_page'   => -1,
				'has_password'     => false,
				'suppress_filters' => true, // WPML: all languages
				'lang'             => '',   // Polylang: all languages
				'orderby'          => 'ID',
				'order'            => 'ASC',
				'no_found_rows'    => true,
			)
		);
		$pages    = array();
		foreach ( $query->posts as $post ) {
			if ( in_array( $post->post_name, $excluded, true ) ) {
				continue;
			}
			$pages[] = array(
				'external_id' => $post->ID,
				'url'         => get_permalink( $post ),
				'lang'        => self::post_language( $post->ID ),
				'title'       => html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' ),
				'html'        => self::rendered_content( $post ),
				'modified'    => get_post_modified_time( 'c', true, $post ),
			);
		}
		wp_reset_postdata();
		return $pages;
	}

	private static function rendered_content( $post ) {
		$html = '';
		if ( class_exists( '\Elementor\Plugin' ) && get_post_meta( $post->ID, '_elementor_edit_mode', true ) === 'builder' ) {
			$elementor = \Elementor\Plugin::$instance;
			if ( isset( $elementor->frontend ) ) {
				$html = (string) $elementor->frontend->get_builder_content_for_display( $post->ID, false );
			}
		}
		if ( '' === trim( wp_strip_all_tags( $html ) ) ) {
			$GLOBALS['post'] = $post; // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- shortcodes expect the global post
			setup_postdata( $post );
			$html = apply_filters( 'the_content', $post->post_content ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals
		}
		// Scripts and styles are useless for the text index and make payloads larger.
		return preg_replace( '#<(script|style|noscript|svg)\b[^>]*>.*?</\1>#is', ' ', $html );
	}

	private static function post_language( $post_id ) {
		if ( function_exists( 'pll_get_post_language' ) ) {
			$lang = pll_get_post_language( $post_id, 'slug' );
			if ( $lang ) {
				return $lang;
			}
		}
		$details = apply_filters( 'wpml_post_language_details', null, $post_id );
		if ( is_array( $details ) && ! empty( $details['language_code'] ) ) {
			return $details['language_code'];
		}
		return substr( get_locale(), 0, 2 );
	}

	/**
	 * Sends items in batches below MAX_BATCH_BYTES.
	 */
	private static function send_batches( $kind, $items, $run_started, $mark_final = false ) {
		$batches = array();
		$current = array();
		$size    = 0;
		foreach ( $items as $item ) {
			$item_size = strlen( wp_json_encode( $item ) );
			if ( $current && $size + $item_size > self::MAX_BATCH_BYTES ) {
				$batches[] = $current;
				$current   = array();
				$size      = 0;
			}
			$current[] = $item;
			$size     += $item_size;
		}
		$batches[] = $current; // also sends an empty batch, so the server can finalize

		$total = 0;
		$count = count( $batches );
		foreach ( $batches as $i => $batch ) {
			$body = array(
				'kind'           => $kind,
				'items'          => $batch,
				'run_started_at' => $run_started,
			);
			if ( $mark_final ) {
				$body['final'] = ( $i === $count - 1 );
			}
			$result = self::post( $body );
			if ( ! $result['ok'] ) {
				return $result;
			}
			$total += isset( $result['data']['count'] ) ? (int) $result['data']['count'] : 0;
		}
		return array(
			'ok'      => true,
			'message' => sprintf( '%d elementi letti, %d salvati', count( $items ), $total ),
		);
	}

	private static function post( $body ) {
		$settings = self::settings();
		if ( empty( $settings['key'] ) || empty( $settings['endpoint'] ) ) {
			return array( 'ok' => false, 'message' => 'Endpoint o chiave mancanti nelle impostazioni.' );
		}
		$response = wp_remote_post(
			$settings['endpoint'],
			array(
				'timeout' => 120,
				'headers' => array(
					'Content-Type'      => 'application/json',
					'x-wizard-sync-key' => $settings['key'],
				),
				'body'    => wp_json_encode( $body ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return array( 'ok' => false, 'message' => $response->get_error_message() );
		}
		$code = wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 || empty( $data['ok'] ) ) {
			$error = is_array( $data ) && ! empty( $data['error'] ) ? $data['error'] : wp_remote_retrieve_body( $response );
			return array( 'ok' => false, 'message' => sprintf( 'HTTP %d: %s', $code, substr( (string) $error, 0, 300 ) ) );
		}
		return array( 'ok' => true, 'data' => $data, 'message' => isset( $data['message'] ) ? $data['message'] : 'OK' );
	}

	/* ---------------------------------------------------------------------
	 * Admin page (Impostazioni → Jesolo Wizard Sync)
	 * ------------------------------------------------------------------- */

	public static function admin_menu() {
		add_options_page( 'Jesolo Wizard Sync', 'Jesolo Wizard Sync', 'manage_options', 'jesolo-wizard-sync', array( __CLASS__, 'render_page' ) );
	}

	private static function check_request( $action ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Permesso negato.' );
		}
		check_admin_referer( $action );
	}

	private static function back( $notice ) {
		set_transient( 'jws_notice_' . get_current_user_id(), $notice, 60 );
		wp_safe_redirect( admin_url( 'options-general.php?page=jesolo-wizard-sync' ) );
		exit;
	}

	public static function handle_save() {
		self::check_request( 'jws_save' );
		$settings                  = self::settings();
		$settings['endpoint']      = esc_url_raw( wp_unslash( $_POST['endpoint'] ?? '' ) );
		$settings['exclude_slugs'] = sanitize_textarea_field( wp_unslash( $_POST['exclude_slugs'] ?? '' ) );
		update_option( self::OPTION, $settings, false );
		self::back( array( 'ok' => true, 'message' => 'Impostazioni salvate.' ) );
	}

	public static function handle_new_key() {
		self::check_request( 'jws_new_key' );
		$settings        = self::settings();
		$settings['key'] = self::generate_key();
		update_option( self::OPTION, $settings, false );
		self::back( array( 'ok' => true, 'message' => 'Nuova chiave generata: copiala anche su Supabase (secret WP_SYNC_KEY).' ) );
	}

	public static function handle_test() {
		self::check_request( 'jws_test' );
		$result = self::post( array( 'kind' => 'ping' ) );
		self::back( array( 'ok' => $result['ok'], 'message' => 'Test connessione: ' . $result['message'] ) );
	}

	public static function handle_sync_now() {
		self::check_request( 'jws_sync_now' );
		$report = self::run_sync();
		$ok     = ! in_array( false, wp_list_pluck( $report, 'ok' ), true );
		self::back( array( 'ok' => $ok, 'message' => $ok ? 'Sincronizzazione completata.' : 'Sincronizzazione completata con errori: vedi il dettaglio qui sotto.' ) );
	}

	public static function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$settings = self::settings();
		$last     = get_option( self::LAST_RUN );
		$next     = wp_next_scheduled( self::CRON_HOOK );
		$notice   = get_transient( 'jws_notice_' . get_current_user_id() );
		delete_transient( 'jws_notice_' . get_current_user_id() );
		$tz       = wp_timezone();
		?>
		<div class="wrap">
			<h1>Jesolo Wizard Sync</h1>
			<?php if ( $notice ) : ?>
				<div class="notice <?php echo $notice['ok'] ? 'notice-success' : 'notice-error'; ?>"><p><?php echo esc_html( $notice['message'] ); ?></p></div>
			<?php endif; ?>

			<p>Invia al Wizard di Jesolo eventi, attività, impianti sportivi, percorsi bici, stabilimenti e pagine di questo sito, ogni 3 giorni.</p>

			<h2>Chiave di sincronizzazione</h2>
			<p>Copia questa chiave nel secret <code>WP_SYNC_KEY</code> delle Edge Functions su Supabase. Non condividerla con altri.</p>
			<p><input type="text" readonly class="large-text code" value="<?php echo esc_attr( $settings['key'] ); ?>" onclick="this.select();"></p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return confirm('Generare una nuova chiave? Dovrai aggiornarla anche su Supabase.');">
				<input type="hidden" name="action" value="jws_new_key">
				<?php wp_nonce_field( 'jws_new_key' ); ?>
				<?php submit_button( 'Genera nuova chiave', 'secondary', 'submit', false ); ?>
			</form>

			<h2>Azioni</h2>
			<p>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
					<input type="hidden" name="action" value="jws_test">
					<?php wp_nonce_field( 'jws_test' ); ?>
					<?php submit_button( 'Test connessione', 'secondary', 'submit', false ); ?>
				</form>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline">
					<input type="hidden" name="action" value="jws_sync_now">
					<?php wp_nonce_field( 'jws_sync_now' ); ?>
					<?php submit_button( 'Sincronizza ora', 'primary', 'submit', false ); ?>
				</form>
			</p>
			<p>Prossima sincronizzazione automatica:
				<strong><?php echo $next ? esc_html( wp_date( 'd/m/Y H:i', $next, $tz ) ) : 'non pianificata (disattiva e riattiva il plugin)'; ?></strong>
			</p>

			<?php if ( is_array( $last ) && ! empty( $last['report'] ) ) : ?>
				<h2>Ultima sincronizzazione: <?php echo esc_html( wp_date( 'd/m/Y H:i', $last['time'], $tz ) ); ?></h2>
				<table class="widefat striped" style="max-width:900px">
					<thead><tr><th>Fonte</th><th>Esito</th><th>Dettaglio</th></tr></thead>
					<tbody>
					<?php foreach ( $last['report'] as $kind => $row ) : ?>
						<tr>
							<td><code><?php echo esc_html( $kind ); ?></code></td>
							<td><?php echo $row['ok'] ? '✅' : '❌'; ?></td>
							<td><?php echo esc_html( $row['message'] ); ?></td>
						</tr>
					<?php endforeach; ?>
					</tbody>
				</table>
			<?php endif; ?>

			<h2>Impostazioni</h2>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="jws_save">
				<?php wp_nonce_field( 'jws_save' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="jws-endpoint">Indirizzo Supabase</label></th>
						<td><input id="jws-endpoint" name="endpoint" type="url" class="large-text code" value="<?php echo esc_attr( $settings['endpoint'] ); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="jws-exclude">Pagine da escludere</label></th>
						<td>
							<textarea id="jws-exclude" name="exclude_slugs" rows="5" class="large-text code"><?php echo esc_textarea( $settings['exclude_slugs'] ); ?></textarea>
							<p class="description">Uno slug per riga (la parte finale dell'indirizzo della pagina, es. <code>privacy-policy</code>).</p>
						</td>
					</tr>
				</table>
				<?php submit_button( 'Salva impostazioni' ); ?>
			</form>
		</div>
		<?php
	}
}

Jesolo_Wizard_Sync::init();
register_activation_hook( __FILE__, array( 'Jesolo_Wizard_Sync', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Jesolo_Wizard_Sync', 'deactivate' ) );
