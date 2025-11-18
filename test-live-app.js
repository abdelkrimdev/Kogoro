// Test the live application by checking its JavaScript execution
import { launch } from 'puppeteer-core';
import chrome from 'chrome-aws-lambda';

async function testLiveApp() {
  console.log('🚀 Testing live Kogoro application...');
  
  try {
    // Try to connect to existing Chrome instance or launch a new one
    let browser;
    try {
      browser = await launch({
        executablePath: '/usr/bin/google-chrome-stable',
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch (error) {
      console.log('⚠️ Could not launch Chrome, trying alternative approach...');
      console.log('Please manually test the application at http://localhost:3000');
      console.log('\n📋 Manual Testing Checklist:');
      console.log('1. Open http://localhost:3000 in your browser');
      console.log('2. Open Developer Tools (F12)');
      console.log('3. Check the Console tab for any errors');
      console.log('4. Look for the theme toggle button (sun/moon icon) in the header');
      console.log('5. Click the theme toggle to switch between light and dark modes');
      console.log('6. Check if the theme classes are applied to the <html> element');
      console.log('7. Verify that CSS variables are updated correctly');
      console.log('8. Test the theme dropdown (if available) for explicit theme selection');
      console.log('\n🔍 Things to check in DevTools:');
      console.log('- Console: Look for JavaScript errors');
      console.log('- Elements: Check if <html> has "light" or "dark" class');
      console.log('- Computed: Check if CSS variables are applied correctly');
      console.log('- Network: Check if all resources load successfully');
      return;
    }
    
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log(`📝 ${msg.type()}: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.error('❌ Page Error:', error.message);
    });
    
    // Navigate to the app
    console.log('📍 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    
    // Wait for the app to initialize
    await page.waitForTimeout(2000);
    
    // Check if the app loaded properly
    const appLoaded = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    });
    
    if (!appLoaded) {
      console.log('❌ App did not load properly');
      return;
    }
    
    console.log('✅ App loaded successfully');
    
    // Check for theme-related elements
    const themeCheck = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      
      return {
        htmlClasses: html.className,
        hasLightClass: html.classList.contains('light'),
        hasDarkClass: html.classList.contains('dark'),
        bodyBgColor: getComputedStyle(body).backgroundColor,
        bodyTextColor: getComputedStyle(body).color,
        hasThemeToggle: !!document.querySelector('[title="Toggle theme"]'),
        hasThemeButton: !!document.querySelector('button'),
        buttonCount: document.querySelectorAll('button').length,
        cssVars: {
          bgPrimary: getComputedStyle(html).getPropertyValue('--bg-primary').trim(),
          textPrimary: getComputedStyle(html).getPropertyValue('--text-primary').trim()
        }
      };
    });
    
    console.log('🎨 Theme Check Results:', themeCheck);
    
    // Look for theme toggle button
    if (themeCheck.hasThemeToggle) {
      console.log('✅ Theme toggle button found');
      
      // Try to click it
      await page.click('[title="Toggle theme"]');
      await page.waitForTimeout(1000);
      
      // Check theme after click
      const afterClick = await page.evaluate(() => {
        const html = document.documentElement;
        return {
          htmlClasses: html.className,
          hasLightClass: html.classList.contains('light'),
          hasDarkClass: html.classList.contains('dark'),
          bodyBgColor: getComputedStyle(document.body).backgroundColor
        };
      });
      
      console.log('🔄 Theme after toggle:', afterClick);
      
      const themeChanged = themeCheck.hasDarkClass !== afterClick.hasDarkClass ||
                          themeCheck.hasLightClass !== afterClick.hasLightClass;
      
      if (themeChanged) {
        console.log('✅ Theme successfully changed!');
      } else {
        console.log('⚠️ Theme did not change after clicking');
      }
    } else {
      console.log('❌ Theme toggle button not found');
      
      // Try to find any button that might be theme-related
      const buttons = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button'));
        return allButtons.map((btn, index) => ({
          index,
          title: btn.getAttribute('title'),
          text: btn.textContent.trim(),
          className: btn.className,
          innerHTML: btn.innerHTML.substring(0, 100) // First 100 chars
        }));
      });
      
      console.log('🔍 Found buttons:', buttons);
      
      // Try clicking each button to see if any affect the theme
      for (const button of buttons.slice(0, 5)) { // Test first 5 buttons
        console.log(`🎯 Testing button ${button.index}: "${button.title || button.text}"`);
        
        const beforeClick = await page.evaluate(() => {
          const html = document.documentElement;
          return {
            hasLight: html.classList.contains('light'),
            hasDark: html.classList.contains('dark')
          };
        });
        
        await page.click(`button:nth-child(${button.index + 1})`);
        await page.waitForTimeout(1000);
        
        const afterClick = await page.evaluate(() => {
          const html = document.documentElement;
          return {
            hasLight: html.classList.contains('light'),
            hasDark: html.classList.contains('dark')
          };
        });
        
        const changed = beforeClick.hasLight !== afterClick.hasLight ||
                       beforeClick.hasDark !== afterClick.hasDark;
        
        if (changed) {
          console.log(`✅ Button ${button.index} changed the theme!`);
          break;
        }
      }
    }
    
    // Check for any JavaScript errors in the console
    const consoleErrors = await page.evaluate(() => {
      // This would need to be enhanced with proper error catching setup
      return [];
    });
    
    if (consoleErrors.length > 0) {
      console.log('❌ Console errors found:', consoleErrors);
    } else {
      console.log('✅ No console errors detected');
    }
    
    console.log('\n📊 Summary:');
    console.log(`- HTML Classes: "${themeCheck.htmlClasses}"`);
    console.log(`- Light Class: ${themeCheck.hasLightClass}`);
    console.log(`- Dark Class: ${themeCheck.hasDarkClass}`);
    console.log(`- Theme Toggle Found: ${themeCheck.hasThemeToggle}`);
    console.log(`- Total Buttons: ${themeCheck.buttonCount}`);
    console.log(`- Body BG Color: ${themeCheck.bodyBgColor}`);
    console.log(`- Body Text Color: ${themeCheck.bodyTextColor}`);
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Error testing live app:', error.message);
  }
}

testLiveApp();