<?php
defined('ABSPATH') || exit;

class FiftyOneEast_Invoice_Admin {

    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('add_meta_boxes', [$this, 'add_invoice_meta_box']);
        add_filter('woocommerce_admin_order_actions', [$this, 'add_order_list_buttons'], 10, 2);
        add_action('admin_init', [$this, 'handle_invoice_download']);
        add_action('template_redirect', [$this, 'handle_invoice_download']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_styles']);
        add_filter('bulk_actions-edit-shop_order', [$this, 'add_bulk_actions']);
        add_filter('bulk_actions-woocommerce_page_wc-orders', [$this, 'add_bulk_actions']);
        add_action('woocommerce_order_details_after_order_table', [$this, 'customer_invoice_buttons']);
        add_filter('woocommerce_my_account_my_orders_actions', [$this, 'add_my_account_buttons'], 10, 2);
    }

    public function add_invoice_meta_box() {
        $screen = class_exists('\Automattic\WooCommerce\Internal\DataStores\Orders\CustomOrdersTableController')
            && wc_get_container()->get(\Automattic\WooCommerce\Internal\DataStores\Orders\CustomOrdersTableController::class)->custom_orders_table_usage_is_enabled()
            ? wc_get_page_screen_id('shop-order')
            : 'shop_order';

        add_meta_box(
            '51east-invoice-box',
            __('Invoice', '51east-invoice'),
            [$this, 'render_meta_box'],
            $screen,
            'side',
            'default'
        );
    }

    public function render_meta_box($post_or_order) {
        $order = ($post_or_order instanceof WP_Post)
            ? wc_get_order($post_or_order->ID)
            : $post_or_order;

        if (!$order) return;

        $en_url = $this->get_download_url($order->get_id(), 'en');
        $ar_url = $this->get_download_url($order->get_id(), 'ar');
        ?>
        <div style="display:flex; flex-direction:column; gap:8px;">
            <a href="<?php echo esc_url($en_url); ?>" class="button" target="_blank">
                📄 Download Invoice (English)
            </a>
            <a href="<?php echo esc_url($ar_url); ?>" class="button" target="_blank" style="direction:rtl;">
                📄 تحميل الفاتورة (عربي)
            </a>
            <a href="<?php echo esc_url($en_url . '&preview=1'); ?>" class="button button-link" target="_blank">
                Preview English
            </a>
            <a href="<?php echo esc_url($ar_url . '&preview=1'); ?>" class="button button-link" target="_blank" style="direction:rtl;">
                معاينة عربي
            </a>
        </div>
        <?php
    }

    public function add_order_list_buttons($actions, $order) {
        $actions['invoice_en'] = [
            'url'    => $this->get_download_url($order->get_id(), 'en'),
            'name'   => __('Invoice EN', '51east-invoice'),
            'action' => 'invoice_en',
        ];
        $actions['invoice_ar'] = [
            'url'    => $this->get_download_url($order->get_id(), 'ar'),
            'name'   => __('Invoice AR', '51east-invoice'),
            'action' => 'invoice_ar',
        ];
        return $actions;
    }

    public function handle_invoice_download() {
        if (!isset($_GET['51east_invoice'], $_GET['order_id'], $_GET['lang'], $_GET['_wpnonce'])) {
            return;
        }

        $order_id = absint($_GET['order_id']);
        $lang = sanitize_text_field($_GET['lang']);

        $is_admin = current_user_can('manage_woocommerce');
        $is_customer = false;

        if (!$is_admin) {
            $order = wc_get_order($order_id);
            if ($order && get_current_user_id() === $order->get_customer_id() && get_current_user_id() > 0) {
                $is_customer = true;
            }
        }

        if (!$is_admin && !$is_customer) {
            wp_die(__('You do not have permission to view this invoice.', '51east-invoice'));
        }

        $nonce_action = $is_admin ? '51east_invoice_admin_' . $order_id : '51east_invoice_customer_' . $order_id;
        if (!wp_verify_nonce($_GET['_wpnonce'], $nonce_action)) {
            wp_die(__('Security check failed.', '51east-invoice'));
        }

        $generator = new FiftyOneEast_Invoice_Generator($order_id, $lang);

        if (isset($_GET['preview'])) {
            echo $generator->get_html();
            exit;
        }

        $generator->stream_pdf();
    }

    public function customer_invoice_buttons($order) {
        if (!$order || !is_user_logged_in()) return;

        $en_url = $this->get_customer_download_url($order->get_id(), 'en');
        $ar_url = $this->get_customer_download_url($order->get_id(), 'ar');
        ?>
        <div style="margin-top:16px;">
            <h3><?php esc_html_e('Download Invoice', '51east-invoice'); ?></h3>
            <a href="<?php echo esc_url($en_url); ?>" class="button" target="_blank">
                Invoice (English)
            </a>
            <a href="<?php echo esc_url($ar_url); ?>" class="button" target="_blank" style="direction:rtl; margin-left:8px;">
                الفاتورة (عربي)
            </a>
        </div>
        <?php
    }

    public function add_my_account_buttons($actions, $order) {
        $actions['invoice_en'] = [
            'url'  => $this->get_customer_download_url($order->get_id(), 'en'),
            'name' => __('Invoice EN', '51east-invoice'),
        ];
        $actions['invoice_ar'] = [
            'url'  => $this->get_customer_download_url($order->get_id(), 'ar'),
            'name' => __('Invoice AR', '51east-invoice'),
        ];
        return $actions;
    }

    public function add_bulk_actions($actions) {
        $actions['download_invoices_en'] = __('Download Invoices (English)', '51east-invoice');
        $actions['download_invoices_ar'] = __('Download Invoices (Arabic)', '51east-invoice');
        return $actions;
    }

    public function enqueue_styles($hook) {
        if (!in_array($hook, ['edit.php', 'woocommerce_page_wc-orders'], true)) return;

        wp_add_inline_style('woocommerce_admin_styles', '
            .wc-action-button-invoice_en::after,
            .wc-action-button-invoice_ar::after {
                font-family: dashicons !important;
                content: "\f497" !important;
            }
        ');
    }

    private function get_download_url($order_id, $lang) {
        return wp_nonce_url(
            admin_url('admin.php?51east_invoice=1&order_id=' . $order_id . '&lang=' . $lang),
            '51east_invoice_admin_' . $order_id
        );
    }

    private function get_customer_download_url($order_id, $lang) {
        return wp_nonce_url(
            home_url('?51east_invoice=1&order_id=' . $order_id . '&lang=' . $lang),
            '51east_invoice_customer_' . $order_id
        );
    }
}
