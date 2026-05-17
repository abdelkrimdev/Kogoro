// Debug what's being rendered
const fs = require('fs');
const path = require('path');

// Read the ErrorBoundary test file to see what error is being thrown
const testFile = fs.readFileSync('./src/components/ui/ErrorBoundary.test.tsx', 'utf8');
const lines = testFile.split('\n');

// Find the test that throws "Test error"
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("throw new Error('Test error')")) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
    console.log(`Context: ${lines[Math.max(0, i - 2)]}`);
    console.log(`Context: ${lines[Math.max(0, i - 1)]}`);
    console.log(`Context: ${lines[i]}`);
    console.log(`Context: ${lines[Math.min(lines.length - 1, i + 1)]}`);
    console.log(`Context: ${lines[Math.min(lines.length - 1, i + 2)]}`);
    break;
  }
}