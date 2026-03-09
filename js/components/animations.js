export class TypewriterEffect {
    constructor(inputElement, prefix, phrases) {
        this.inputElement = inputElement;
        this.prefix = prefix;
        this.prefixDisplay = prefix.charAt(0).toUpperCase() + prefix.slice(1) + ' ';
        this.phrases = phrases;

        this.phraseIndex = 0;
        this.charIndex = 0;
        this.isDeleting = false;
        this.isRunning = true;
        this.timeout = null;
    }

    type() {
        if (!this.isRunning) return;
        const currentPhrase = this.phrases[this.phraseIndex];

        if (this.isDeleting) {
            this.inputElement.placeholder = this.prefixDisplay + currentPhrase.substring(0, this.charIndex - 1);
            this.charIndex--;
        } else {
            this.inputElement.placeholder = this.prefixDisplay + currentPhrase.substring(0, this.charIndex + 1);
            this.charIndex++;
        }

        let typeSpeed = this.isDeleting ? 30 : 80;

        if (!this.isDeleting && this.charIndex === currentPhrase.length) {
            typeSpeed = 2000;
            this.isDeleting = true;
        } else if (this.isDeleting && this.charIndex === 0) {
            this.isDeleting = false;
            this.phraseIndex = (this.phraseIndex + 1) % this.phrases.length;
            typeSpeed = 500;
        }

        this.timeout = setTimeout(() => this.type(), typeSpeed);
    }

    start() {
        if (this.inputElement.value === '') {
            this.isRunning = true;
            this.type();
        }
    }

    stop() {
        this.isRunning = false;
        clearTimeout(this.timeout);
        this.inputElement.placeholder = this.prefixDisplay + "...";
    }
}
