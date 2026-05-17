// Test categorization of "Test error"
const error = new Error('Test error');
const message = error.message.toLowerCase();

console.log('Message:', message);
console.log('Includes validation:', message.includes('validation'));
console.log('Includes render:', message.includes('render'));
console.log('Includes network:', message.includes('network'));
console.log('Includes permission:', message.includes('permission'));
console.log('Includes motion:', message.includes('motion'));
console.log('Includes invalid:', message.includes('invalid'));
console.log('Includes input:', message.includes('input'));