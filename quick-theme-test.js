// Quick test to check if theme functionality is working
console.log('🔍 Testing Kogoro theme functionality...');

// Test 1: Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000');
    if (response.ok) {
      console.log('✅ Server is running on http://localhost:3000');
      return true;
    }
  } catch (error) {
    console.log('❌ Server is not running. Start it with: bun run dev');
    return false;
  }
}

// Test 2: Check theme CSS variables
async function checkThemeCSS() {
  try {
    const cssResponse = await fetch('http://localhost:3000/src/main.css');
    if (cssResponse.ok) {
      const css = await cssResponse.text();
      
      const hasLightVars = css.includes('--bg-primary: 255 255 255');
      const hasDarkVars = css.includes('.dark') && css.includes('--bg-primary: 17 24 39');
      const hasTextVars = css.includes('--text-primary: 17 24 39');
      
      console.log('🎨 CSS Theme Variables:');
      console.log(`  Light theme: ${hasLightVars ? '✅' : '❌'}`);
      console.log(`  Dark theme: ${hasDarkVars ? '✅' : '❌'}`);
      console.log(`  Text colors: ${hasTextVars ? '✅' : '❌'}`);
      
      return hasLightVars && hasDarkVars;
    }
  } catch (error) {
    console.log('❌ Could not check CSS theme variables');
    return false;
  }
}

// Test 3: Manual testing instructions
function showManualTestInstructions() {
  console.log('\n📋 Manual Testing Instructions:');
  console.log('1. Open http://localhost:3000 in your browser');
  console.log('2. Open Developer Tools (F12)');
  console.log('3. Go to Console tab and run these commands:');
  console.log('');
  console.log('// Check current theme:');
  console.log('document.documentElement.className');
  console.log('');
  console.log('// Force light mode:');
  console.log('document.documentElement.classList.remove("dark");');
  console.log('document.documentElement.classList.add("light");');
  console.log('');
  console.log('// Force dark mode:');
  console.log('document.documentElement.classList.remove("light");');
  console.log('document.documentElement.classList.add("dark");');
  console.log('');
  console.log('// Check CSS variables:');
  console.log('getComputedStyle(document.documentElement).getPropertyValue("--bg-primary")');
  console.log('getComputedStyle(document.documentElement).getPropertyValue("--text-primary")');
  console.log('');
  console.log('4. Look for the theme toggle button (sun/moon icon) in the header');
  console.log('5. Click it to test theme switching');
  console.log('6. Check if the page styling changes correctly');
}

// Run tests
async function runTests() {
  const serverRunning = await checkServer();
  
  if (serverRunning) {
    await checkThemeCSS();
    showManualTestInstructions();
  }
  
  console.log('\n🔧 Quick Fix for Light Mode Issue:');
  console.log('If light mode isn\'t working, try this:');
  console.log('1. Open browser console');
  console.log('2. Run: document.documentElement.classList.add("light");');
  console.log('3. Check if styling updates');
  console.log('');
  console.log('💡 The issue might be that the default theme is "auto",');
  console.log('so it uses system preference. Try explicitly selecting "Light"');
  console.log('from the theme dropdown in the header.');
}

runTests();