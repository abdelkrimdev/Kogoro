const testError = new Error('Conditional error');
console.log('Message:', testError.message.toLowerCase());
console.log('Contains component:', testError.message.toLowerCase().includes('component'));