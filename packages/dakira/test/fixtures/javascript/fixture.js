class SayHello {
	sayHello = "ciao";
	constructor(sayHello) {
		this.sayHello = sayHello;
		console.log(this.sayHello);
	}
}
new SayHello("ciao");

function sayHello(name) {
	const greet = "ciao";
	console.log(`${greet} ${name}`);
}

let greet = "ciao";

greet = "hello";

const name = sayHello("Marco");
