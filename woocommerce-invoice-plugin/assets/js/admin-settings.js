(function ($) {
    'use strict';

    $(function () {
        var frame;
        var $logoField = $('#_51east_invoice_logo_url_field');

        if (!$logoField.length) return;

        $logoField.on('click', '.upload-logo-btn', function (e) {
            e.preventDefault();

            if (frame) {
                frame.open();
                return;
            }

            frame = wp.media({
                title: 'Select Logo',
                button: { text: 'Use as Logo' },
                multiple: false,
                library: { type: 'image' },
            });

            frame.on('select', function () {
                var attachment = frame.state().get('selection').first().toJSON();
                $('#51east_invoice_logo_url').val(attachment.url);
                $logoField.find('.logo-preview').html(
                    '<img src="' + attachment.url + '" style="max-width:200px;max-height:80px;display:block;margin-top:8px;">'
                );
            });

            frame.open();
        });

        $logoField.on('click', '.remove-logo-btn', function (e) {
            e.preventDefault();
            $('#51east_invoice_logo_url').val('');
            $logoField.find('.logo-preview').html('');
        });
    });
})(jQuery);
