import puppeteer from 'puppeteer';

async function testThemeFunctionality() {
  console.log('🚀 Starting theme functionality test...');
  
  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless mode
    defaultViewport: { width: 1280, height: 800 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable console logging from the page
    page.on('console', msg => {
      console.log('📝 Browser Console:', msg.text());
    });
    
    // Navigate to the app
    console.log('📍 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Wait for the app to load
    await page.waitForSelector('#root', { timeout: 10000 });
    console.log('✅ App loaded successfully');
    
    // Get initial theme state
    const initialTheme = await page.evaluate(() => {
      const html = document.documentElement;
      return {
        classes: html.className,
        hasLight: html.classList.contains('light'),
        hasDark: html.classList.contains('dark'),
        computedBgColor: getComputedStyle(document.body).backgroundColor,
        computedTextColor: getComputedStyle(document.body).color,
        cssVars: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim()
      };
    });
    
    console.log('🎨 Initial theme state:', initialTheme);
    
    // Look for theme toggle button
    console.log('🔍 Looking for theme toggle button...');
    const themeButton = await page.$('button[title="Toggle theme"]');
    
    if (!themeButton) {
      console.log('❌ Theme toggle button not found. Looking for alternatives...');
      
      // Try to find any button that might be theme-related
      const allButtons = await page.$$('button');
      console.log(`Found ${allButtons.length} buttons on the page`);
      
      for (let i = 0; i < allButtons.length; i++) {
        const button = allButtons[i];
        const title = await page.evaluate(el => el.getAttribute('title'), button);
        const text = await page.evaluate(el => el.textContent, button);
        console.log(`Button ${i}: title="${title}", text="${text}"`);
      }
    } else {
      console.log('✅ Theme toggle button found!');
      
      // Click the theme toggle button
      console.log('🔄 Clicking theme toggle button...');
      await themeButton.click();
      
      // Wait for theme transition
      await page.waitForTimeout(500);
      
      // Check theme after toggle
      const afterToggleTheme = await page.evaluate(() => {
        const html = document.documentElement;
        return {
          classes: html.className,
          hasLight: html.classList.contains('light'),
          hasDark: html.classList.contains('dark'),
          computedBgColor: getComputedStyle(document.body).backgroundColor,
          computedTextColor: getComputedStyle(document.body).color,
          cssVars: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim()
        };
      });
      
      console.log('🎨 Theme after toggle:', afterToggleTheme);
      
      // Check if theme actually changed
      const themeChanged = initialTheme.hasLight !== afterToggleTheme.hasLight || 
                          initialTheme.hasDark !== afterToggleTheme.hasDark;
      
      if (themeChanged) {
        console.log('✅ Theme successfully changed!');
      } else {
        console.log('⚠️ Theme did not change after clicking toggle button');
      }
      
      // Try to find and click theme dropdown
      console.log('🔍 Looking for theme dropdown...');
      
      // Look for sun/moon/monitor icons
      const themeIcons = await page.$$('svg');
      console.log(`Found ${themeIcons.length} SVG icons`);
      
      // Try to open theme dropdown by clicking the theme button again
      await themeButton.click();
      await page.waitForTimeout(300);
      
      // Look for dropdown menu
      const dropdown = await page.$('.absolute.right-0.mt-2');
      if (dropdown) {
        console.log('✅ Theme dropdown found!');
        
        // Get dropdown options
        const options = await page.evaluate(() => {
          const buttons = document.querySelectorAll('.absolute.right-0.mt-2 button');
          return Array.from(buttons).map(btn => ({
            text: btn.textContent.trim(),
            classes: btn.className
          }));
        });
        
        console.log('📋 Theme options:', options);
        
        // Try clicking each option
        for (const option of options) {
          console.log(`🎯 Clicking option: "${option.text}"`);
          const optionButton = await page.$(`button:has-text("${option.text}")`);
          if (optionButton) {
            await optionButton.click();
            await page.waitForTimeout(500);
            
            // Check theme after selection
            const currentTheme = await page.evaluate(() => {
              const html = document.documentElement;
              return {
                classes: html.className,
                hasLight: html.classList.contains('light'),
                hasDark: html.classList.contains('dark'),
                bgColor: getComputedStyle(document.body).backgroundColor
              };
            });
            
            console.log(`🎨 Theme after selecting "${option.text}":`, currentTheme);
          }
        }
      } else {
        console.log('❌ Theme dropdown not found');
      }
    }
    
    // Check dashboard elements styling
    console.log('🔍 Checking dashboard elements...');
    
    const dashboardElements = await page.evaluate(() => {
      const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');
      const headers = document.querySelectorAll('h1, h2, h3');
      const texts = document.querySelectorAll('p, span');
      
      return {
        cardCount: cards.length,
        headerCount: headers.length,
        textCount: texts.length,
        cardStyles: Array.from(cards).slice(0, 3).map(card => ({
          background: getComputedStyle(card).backgroundColor,
          color: getComputedStyle(card).color,
          border: getComputedStyle(card).borderColor
        })),
        headerStyles: Array.from(headers).slice(0, 3).map(header => ({
          color: getComputedStyle(header).color,
          background: getComputedStyle(header).backgroundColor
        }))
      };
    });
    
    console.log('📊 Dashboard elements:', dashboardElements);
    
    // Check for console errors
    console.log('🔍 Checking for console errors...');
    const logs = await page.evaluate(() => {
      // This would need to be enhanced with proper error catching
      return 'No direct error access in this context';
    });
    
    console.log('📝 Console logs:', logs);
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
  } finally {
    console.log('🏁 Test completed. Keeping browser open for manual inspection...');
    // Uncomment the line below to close the browser automatically
    // await browser.close();
  }
}

// Check if we have the required dependencies
try {
  testThemeFunctionality();
} catch (error) {
  console.log('❌ Error running test:', error.message);
  console.log('Make sure puppeteer is installed: bun add puppeteer');
}