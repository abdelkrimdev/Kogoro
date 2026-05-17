const testError = new Error('Conditional error');
console.log('Message:', testError.message.toLowerCase());
console.log('Contains render:', testError.message.toLowerCase().includes('render'));
console.log('Contains display:', testError.message.toLowerCase().includes('display'));
console.log('Contains dom:', testError.message.toLowerCase().includes('dom'));
console.log('Contains element:', testError.message.toLowerCase().includes('element'));
console.log('Contains component:', testError.message.toLowerCase().includes('component'));