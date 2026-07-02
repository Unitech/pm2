// Erasable-only TypeScript syntax: runnable by node type stripping,
// unlike echo.ts whose constructor parameter property requires a transform
interface Greeting {
  message: string;
}

const greeting: Greeting = { message: "Hello Typescript!" };

console.log(greeting.message);

setInterval(function (): void {}, 2000);
