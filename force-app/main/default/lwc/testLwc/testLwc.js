import { LightningElement } from 'lwc';

export default class HelloWorld extends LightningElement {
    message;

    handleClick() {
        this.message = 'Button clicked! pipeline delta added succesfully 4 9🎉';
    }
}
