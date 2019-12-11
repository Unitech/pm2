
class Greeter {
  constructor(public greeting: string) { }
  greet() {
    return this.greeting;
  }
};

var greeter = new Greeter("Hello Typescript!");

console.log(greeter.greet());
