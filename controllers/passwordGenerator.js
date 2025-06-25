const generator = require('generate-password');

const passwordGenerator = () => {
    const password = generator.generate({
        length: 6,
        numbers: true
    });
    console.log('This is new random PASSWORD :', password);
    return password;
}
module.exports = passwordGenerator;