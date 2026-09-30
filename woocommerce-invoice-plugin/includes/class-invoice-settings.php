<?php
defined('ABSPATH') || exit;

class FiftyOneEast_Invoice_Settings {

    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_filter('woocommerce_settings_tabs_array', [$this, 'add_settings_tab'], 50);
        add_action('woocommerce_settings_tabs_51east_invoice', [$this, 'settings_tab']);
        add_action('woocommerce_update_options_51east_invoice', [$this, 'update_settings']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_scripts']);
    }

    public function add_settings_tab($tabs) {
        $tabs['51east_invoice'] = __('Invoice', '51east-invoice');
        return $tabs;
    }

    public function settings_tab() {
        woocommerce_admin_fields($this->get_settings());
    }

    public function enqueue_admin_scripts() {
        $screen = get_current_screen();
        $is_wc_settings = (
            (isset($_GET['page']) && $_GET['page'] === 'wc-settings') ||
            ($screen && strpos($screen->id, 'wc-settings') !== false)
        );

        if (!$is_wc_settings) return;
        if (!isset($_GET['tab']) || $_GET['tab'] !== '51east_invoice') return;

        wp_enqueue_media();
        wp_enqueue_script(
            '51east-invoice-admin',
            FIFTYONE_EAST_INVOICE_URL . 'assets/js/admin-settings.js',
            ['jquery', 'wp-mediaelement'],
            FIFTYONE_EAST_INVOICE_VERSION,
            true
        );
    }

    public function update_settings() {
        woocommerce_update_options($this->get_settings());

        if (isset($_POST['51east_invoice_logo_url'])) {
            $logo_url = esc_url_raw(wp_unslash($_POST['51east_invoice_logo_url']));
            update_option('51east_invoice_logo_url', $logo_url);
        }
    }

    private function get_settings() {
        $logo_url = self::get_logo_url();
        $logo_preview = '';
        if ($logo_url) {
            $logo_preview = '<img src="' . esc_url($logo_url) . '" style="max-width:200px;max-height:80px;display:block;margin:8px 0;">';
        }

        return [
            'section_title' => [
                'name' => __('Invoice Settings', '51east-invoice'),
                'type' => 'title',
                'desc' => __('Configure your invoice details. These appear on every generated invoice.', '51east-invoice'),
                'id'   => '51east_invoice_section_title',
            ],
            'logo_url' => [
                'name'     => __('Company Logo', '51east-invoice'),
                'type'     => 'text',
                'id'       => '51east_invoice_logo_url',
                'default'  => '',
                'desc'     => $logo_preview . '<br><button type="button" class="button 51east-upload-logo-btn" style="margin-top:4px;">'
                    . esc_html__('Upload / Select Logo', '51east-invoice') . '</button> '
                    . '<button type="button" class="button 51east-remove-logo-btn" style="margin-top:4px;">'
                    . esc_html__('Remove Logo', '51east-invoice') . '</button>'
                    . '<br><small>' . esc_html__('Paste a URL or click Upload to use the Media Library. Recommended: PNG or JPG, max 400x200px.', '51east-invoice') . '</small>',
                'desc_tip' => false,
                'css'      => 'width: 400px;',
            ],
            'company_name_en' => [
                'name'     => __('Company Name (English)', '51east-invoice'),
                'type'     => 'text',
                'id'       => '51east_invoice_company_name_en',
                'default'  => '',
            ],
            'company_name_ar' => [
                'name'     => __('Company Name (Arabic)', '51east-invoice'),
                'type'     => 'text',
                'id'       => '51east_invoice_company_name_ar',
                'default'  => '',
                'css'      => 'direction: rtl;',
            ],
            'address_en' => [
                'name'     => __('Address (English)', '51east-invoice'),
                'type'     => 'textarea',
                'id'       => '51east_invoice_address_en',
                'default'  => '',
                'css'      => 'height: 80px;',
            ],
            'address_ar' => [
                'name'     => __('Address (Arabic)', '51east-invoice'),
                'type'     => 'textarea',
                'id'       => '51east_invoice_address_ar',
                'default'  => '',
                'css'      => 'direction: rtl; height: 80px;',
            ],
            'phone' => [
                'name'     => __('Phone Number', '51east-invoice'),
                'type'     => 'text',
                'id'       => '51east_invoice_phone',
                'default'  => '',
            ],
            'email' => [
                'name'     => __('Email', '51east-invoice'),
                'type'     => 'text',
                'id'       => '51east_invoice_email',
                'default'  => '',
            ],
            'tax_number' => [
                'name'     => __('Tax Registration Number', '51east-invoice'),
                'type'     => 'text',
                'id'       => '51east_invoice_tax_number',
                'default'  => '',
            ],
            'invoice_prefix' => [
                'name'     => __('Invoice Number Prefix', '51east-invoice'),
                'type'     => 'text',
                'id'       => '51east_invoice_prefix',
                'default'  => 'INV-',
                'desc'     => __('e.g. INV- will generate INV-00001', '51east-invoice'),
            ],
            'footer_note_en' => [
                'name'     => __('Footer Note (English)', '51east-invoice'),
                'type'     => 'textarea',
                'id'       => '51east_invoice_footer_en',
                'default'  => 'Thank you for your business!',
                'css'      => 'height: 60px;',
            ],
            'footer_note_ar' => [
                'name'     => __('Footer Note (Arabic)', '51east-invoice'),
                'type'     => 'textarea',
                'id'       => '51east_invoice_footer_ar',
                'default'  => 'شكراً لتعاملكم معنا!',
                'css'      => 'direction: rtl; height: 60px;',
            ],
            'currency_en' => [
                'name'     => __('Currency Label (English)', '51east-invoice'),
                'type'     => 'text',
                'id'       => '51east_invoice_currency_en',
                'default'  => '',
                'desc'     => __('Leave blank to use WooCommerce currency symbol.', '51east-invoice'),
            ],
            'currency_ar' => [
                'name'     => __('Currency Label (Arabic)', '51east-invoice'),
                'type'     => 'text',
                'id'       => '51east_invoice_currency_ar',
                'default'  => '',
                'desc'     => __('e.g. د.إ or ريال', '51east-invoice'),
                'css'      => 'direction: rtl;',
            ],
            'accent_color' => [
                'name'     => __('Accent Color', '51east-invoice'),
                'type'     => 'color',
                'id'       => '51east_invoice_accent_color',
                'default'  => '#2c3e50',
                'desc'     => __('Header, table header, and accent color on the invoice.', '51east-invoice'),
            ],
            'section_end' => [
                'type' => 'sectionend',
                'id'   => '51east_invoice_section_end',
            ],
        ];
    }

    public static function get($key, $default = '') {
        return get_option('51east_invoice_' . $key, $default);
    }

    public static function get_logo_url() {
        return get_option('51east_invoice_logo_url', '');
    }
}
