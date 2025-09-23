public with sharing class test1 {
    
    // Hardcoded password (Fortify should flag this)
    private String password = 'SuperSecret123';

    public test1() {
        // constructor
    }

    // Example: Vulnerable SOQL (SOQL Injection)
    public List<Account> getAccounts(String userInput) {
        // BAD: Concatenating user input directly
        String query = 'SELECT Id, Name FROM Account WHERE Name LIKE \'' + userInput + '%\'';
        return Database.query(query); // Fortify should flag this as SOQL Injection
    }

    // Example: Insecure logging of sensitive info
    public void logPassword() {
        System.debug('Password is: ' + password); // Fortify should flag sensitive info exposure
    }

    // Example: Insecure DML inside loops
    public void updateAccounts(List<Account> accounts) {
        for(Account acc : accounts) {
            acc.Description = 'Test'; 
            update acc; // Fortify should flag DML inside loop
        }
    }

    // Example: Hardcoded API key
    public String getApiKey() {
        return 'AKIA_TEST_KEY_123456'; // Fortify should flag
    }
}
