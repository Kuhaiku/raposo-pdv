document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-recuperar');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        if (email) {
            window.location.href = `/redefinir-senha.html?email=${encodeURIComponent(email)}`;
        }
    });
});