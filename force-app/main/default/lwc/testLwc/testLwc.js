import { LightningElement } from 'lwc';

export default class HelloWorld extends LightningElement {
    message;

    // Hardcoded password for testing purpose only
    password = "SuperSecret123";  // Fortify should flag this

    // Hardcoded API key (example)
    apiKey = "AKIAXXXXXXXTESTKEY"; // Fortify should flag this

    handleClick() {
        this.message = 'Button clicked! pipeline delta added successfully 49🎉';

        // Example of insecure use: logging sensitive data
        console.log("Password is: " + this.password);  // Fortify should flag logging sensitive info

        // Example of insecure eval usage
        const userInput = "2 + 2";
        eval(userInput);  // Fortify should flag this as code injection
    }
}
