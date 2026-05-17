const testError = new Error('Test error');
// Simulate a React/SolidJS stack trace
testError.stack = `Error: Test error
    at ThrowErrorComponent (/src/components/ui/ErrorBoundary.test.tsx:40:11)
    at renderWithHooks (/node_modules/react-dom/cjs/react-dom.development.js:16305:18)
    at mountIndeterminateComponent (/node_modules/react-dom/cjs/react-dom.development.js:20074:13)
    at beginWork (/node_modules/react-dom/cjs/react-dom.development.js:21587:16)
    at HTMLUnknownElement.callCallback (/node_modules/react-dom/cjs/react-dom.development.js:4164:14)
    at Object.invokeGuardedCallbackDev (/node_modules/react-dom/cjs/react-dom.development.js:4213:16)
    at invokeGuardedCallback (/node_modules/react-dom/cjs/react-dom.development.js:4277:31)
    at beginWork$1 (/node_modules/react-dom/cjs/react-dom.development.js:27451:34)
    at performUnitOfWork (/node_modules/react-dom/cjs/react-dom.development.js:26557:12)
    at workLoopSync (/node_modules/react-dom/cjs/react-dom.development.js:26466:5)
    at renderRootSync (/node_modules/react-dom/cjs/react-dom.development.js:26434:7)
    at recoverFromConcurrentError (/node_modules/react-dom/cjs/react-dom.development.js:25850:20)
    at performConcurrentWorkOnRoot (/node_modules/react-dom/cjs/react-dom.development.js:25750:34)
    at flushActWork (/node_modules/react-dom/cjs/react-dom.development.js:24249:24)
    at act (/node_modules/react-dom/cjs/react-dom-test-utils.development.js:1029:11)`;

const message = testError.message.toLowerCase();
const name = testError.name.toLowerCase();
const stack = (testError.stack || '').toLowerCase();

console.log('Message:', message);
console.log('Name:', name);
console.log('Stack contains component:', stack.includes('component'));
console.log('Stack contains react:', stack.includes('react'));
console.log('Stack contains solid:', stack.includes('solid'));

// Check rendering patterns
const renderingPatterns = [
  { pattern: 'render', field: 'message' },
  { pattern: 'display', field: 'message' }, 
  { pattern: 'dom', field: 'message' },
  { pattern: 'element', field: 'message' },
  { pattern: 'component', field: 'message' },
  { pattern: 'component', field: 'stack' },
  { pattern: 'react', field: 'stack' },
  { pattern: 'solid', field: 'stack' }
];

console.log('\nRendering pattern matches:');
renderingPatterns.forEach(({ pattern, field }) => {
  const text = field === 'message' ? message : stack;
  if (text.includes(pattern)) {
    console.log(`✓ Matches: ${pattern} in ${field}`);
  }
});