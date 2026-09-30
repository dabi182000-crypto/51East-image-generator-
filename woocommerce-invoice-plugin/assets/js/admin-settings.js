(function ($) {
    'use strict';

    $(function () {
        var frame;
        var $logoInput = $('#51east_invoice_logo_url');

        if (!$logoInput.length) return;

        $(document).on('click', '.51east-upload-logo-btn', function (e) {
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
                $logoInput.val(attachment.url);
            });

            frame.open();
        });

        $(document).on('click', '.51east-remove-logo-btn', function (e) {
            e.preventDefault();
            $logoInput.val('');
        });
    });
})(jQuery);
