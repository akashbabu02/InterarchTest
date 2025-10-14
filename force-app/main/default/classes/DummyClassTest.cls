@isTest
private class DummyClassTest {
    @isTest static void testSayHello() {
        String result = DummyClass.sayHello();
        System.assertEquals('Hello!', result);
    }
}
