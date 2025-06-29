// script.js for support form email sending
// Uses EmailJS (https://www.emailjs.com/)

// Replace these with your EmailJS service ID, template ID, and public key
const EMAILJS_SERVICE_ID = 'your_service_id';
const EMAILJS_TEMPLATE_ID = 'your_template_id';
const EMAILJS_PUBLIC_KEY = 'your_public_key';

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('support-form');
  const status = document.getElementById('form-status');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = 'Sending...';
      // Collect form data
      const formData = {
        name: form.name.value,
        email: form.email.value,
        message: form.message.value,
      };
      // Send using EmailJS
      emailjs
        .send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          formData,
          EMAILJS_PUBLIC_KEY
        )
        .then(() => {
          status.textContent = 'Message sent! Thank you.';
          form.reset();
        })
        .catch(() => {
          status.textContent = 'Failed to send. Please try again later.';
        });
    });
  }
});
