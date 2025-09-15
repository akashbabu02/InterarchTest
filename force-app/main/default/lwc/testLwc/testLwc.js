import { LightningElement } from 'lwc';

export default class HelloWorld extends LightningElement {
    message;

    handleClick() {
        this.message = 'Button clicked! pipeline has beeen created by succesfully 🎉';
    }
}
