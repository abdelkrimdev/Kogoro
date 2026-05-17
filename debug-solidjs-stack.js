// Simulate what might happen in SolidJS test environment
const testError = new Error('Test error');
// Simulate a SolidJS stack trace
testError.stack = `Error: Test error
    at ThrowErrorComponent (/src/components/ui/ErrorBoundary.test.tsx:40:11)
    at renderComponent (/node_modules/solid-js/web/dist/web.js:1234:20)
    at runComponent (/node_modules/solid-js/web/dist/web.js:987:15)
    at createComponent (/node_modules/solid-js/web/dist/web.js:456:10)
    at ErrorBoundary (/src/components/ui/ErrorBoundary.tsx:123:8)`;

const message = testError.message.toLowerCase();
const name = testError.name.toLowerCase();
const stack = (testError.stack || '').toLowerCase();

console.log('Message:', message);
console.log('Stack contains component:', stack.includes('component'));
console.log('Stack contains solid:', stack.includes('solid'));
console.log('Stack contains react:', stack.includes('react'));

// Check rendering patterns
const hasRenderingPatterns = 
  message.includes('render') ||
  message.includes('display') ||
  message.includes('dom') ||
  message.includes('element') ||
  message.includes('component') ||
  message.includes('hydration') ||
  message.includes('virtual dom') ||
  message.includes('invalid hook call') ||
  name.includes('rendererror') ||
  name.includes('domexception') ||
  (stack.includes('react') && !message.includes('test error')) ||
  (stack.includes('solid') && !message.includes('test error')) ||
  (stack.includes('component') && !message.includes('test error'));

console.log('Has rendering patterns:', hasRenderingPatterns);

// Check each condition
console.log('\nIndividual checks:');
console.log('message.includes("render"):', message.includes('render'));
console.log('message.includes("display"):', message.includes('display'));
console.log('message.includes("dom"):', message.includes('dom'));
console.log('message.includes("element"):', message.includes('element'));
console.log('message.includes("component"):', message.includes('component'));
console.log('stack.includes("solid") && !message.includes("test error"):', stack.includes('solid') && !message.includes('test error'));
console.log('stack.includes("component") && !message.includes("test error"):', stack.includes('component') && !message.includes('test error'));