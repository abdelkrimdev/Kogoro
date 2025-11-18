import http from 'http';

async function testThemeFunctionality() {
  console.log('🚀 Testing theme functionality via HTTP...');
  
  try {
    // Test if the server is responding
    const response = await fetch('http://localhost:3000');
    
    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    
    const html = await response.text();
    console.log('✅ Server is responding');
    
    // Check if the HTML contains theme-related elements
    const hasThemeContext = html.includes('ThemeContext') || html.includes('ThemeProvider');
    const hasThemeToggle = html.includes('Toggle theme') || html.includes('theme-toggle');
    const hasCSSVars = html.includes('--bg-primary') || html.includes('css variables');
    
    console.log('📋 Theme-related elements found:');
    console.log(`  - ThemeContext/ThemeProvider: ${hasThemeContext}`);
    console.log(`  - Theme toggle: ${hasThemeToggle}`);
    console.log(`  - CSS variables: ${hasCSSVars}`);
    
    // Check for theme classes
    const hasLightClass = html.includes('class="light"') || html.includes('classList.add(\'light\')');
    const hasDarkClass = html.includes('class="dark"') || html.includes('classList.add(\'dark\')');
    
    console.log(`  - Light theme class: ${hasLightClass}`);
    console.log(`  - Dark theme class: ${hasDarkClass}`);
    
    // Look for potential issues
    const issues = [];
    
    if (!hasThemeContext) {
      issues.push('ThemeContext or ThemeProvider not found in the HTML');
    }
    
    if (!hasThemeToggle) {
      issues.push('Theme toggle button not found');
    }
    
    if (!hasCSSVars) {
      issues.push('CSS variables for theming not found');
    }
    
    if (issues.length > 0) {
      console.log('\n⚠️ Potential issues found:');
      issues.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('\n✅ All theme-related elements appear to be present');
    }
    
    // Test the CSS file
    console.log('\n🎨 Testing CSS theme variables...');
    try {
      const cssResponse = await fetch('http://localhost:3000/src/main.css');
      if (cssResponse.ok) {
        const css = await cssResponse.text();
        const hasLightVars = css.includes('--bg-primary: 255 255 255');
        const hasDarkVars = css.includes('.dark') && css.includes('--bg-primary: 17 24 39');
        
        console.log(`  - Light theme CSS variables: ${hasLightVars}`);
        console.log(`  - Dark theme CSS variables: ${hasDarkVars}`);
        
        if (!hasLightVars || !hasDarkVars) {
          console.log('⚠️ CSS theme variables may be incomplete');
        } else {
          console.log('✅ CSS theme variables are properly defined');
        }
      }
    } catch (cssError) {
      console.log('⚠️ Could not fetch CSS file:', cssError.message);
    }
    
  } catch (error) {
    console.error('❌ Error testing theme functionality:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the development server is running:');
      console.log('   bun run dev');
    }
  }
}

testThemeFunctionality();