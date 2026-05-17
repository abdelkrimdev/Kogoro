// Test what happens in the actual test environment
const testError = new Error('Test error');
console.log('Original error:', testError);
console.log('Message:', testError.message);
console.log('Name:', testError.name);
console.log('Stack:', testError.stack);

// Simulate what might be happening in test
const message = testError.message.toLowerCase();
const name = testError.name.toLowerCase();
const stack = (testError.stack || '').toLowerCase();

console.log('\nLowercase versions:');
console.log('Message:', message);
console.log('Name:', name);
console.log('Stack contains component:', stack.includes('component'));
console.log('Stack contains react:', stack.includes('react'));
console.log('Stack contains solid:', stack.includes('solid'));

// Check if message contains rendering patterns
console.log('\nMessage patterns:');
console.log('Contains render:', message.includes('render'));
console.log('Contains display:', message.includes('display'));
console.log('Contains dom:', message.includes('dom'));
console.log('Contains element:', message.includes('element'));
console.log('Contains component:', message.includes('component'));