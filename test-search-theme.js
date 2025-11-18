import { chromium } from 'playwright';

async function testSearchTheme() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('🔍 Testing Search Page Theme Functionality');
  console.log('===========================================');
  
  try {
    // Navigate to search page
    await page.goto('http://localhost:3003/search');
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Successfully loaded search page');
    
    // Test 1: Check initial light mode (default)
    console.log('\n📋 Test 1: Initial Light Mode');
    const body = page.locator('body');
    const isLightMode = await body.evaluate(el => 
      !el.classList.contains('dark-theme')
    );
    console.log(isLightMode ? '✅ Default light mode active' : '❌ Not in light mode');
    
    // Test 2: Check search input field theming
    console.log('\n📋 Test 2: Search Input Field Theming');
    const searchInput = page.locator('input[placeholder*="Search for anime"]');
    await searchInput.waitFor();
    
    const inputStyles = await searchInput.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
        borderColor: computed.borderColor,
      };
    });
    console.log('✅ Search input styles:', inputStyles);
    
    // Test 3: Check filter dropdowns theming
    console.log('\n📋 Test 3: Filter Dropdowns Theming');
    const filterSelects = page.locator('select');
    const selectCount = await filterSelects.count();
    console.log(`✅ Found ${selectCount} filter dropdowns`);
    
    for (let i = 0; i < selectCount; i++) {
      const select = filterSelects.nth(i);
      const selectStyles = await select.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          borderColor: computed.borderColor,
        };
      });
      console.log(`  Dropdown ${i + 1}:`, selectStyles);
    }
    
    // Test 4: Check search results cards theming
    console.log('\n📋 Test 4: Search Results Cards Theming');
    const resultCards = page.locator('[class*="motion-card"]');
    const cardCount = await resultCards.count();
    console.log(`✅ Found ${cardCount} result cards`);
    
    if (cardCount > 0) {
      const firstCard = resultCards.first();
      const cardStyles = await firstCard.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          borderColor: computed.borderColor,
        };
      });
      console.log('✅ First card styles:', cardStyles);
    }
    
    // Test 5: Check year badges theming
    console.log('\n📋 Test 5: Year Badges Theming');
    const yearBadges = page.locator('text=/202[0-9]/');
    const badgeCount = await yearBadges.count();
    console.log(`✅ Found ${badgeCount} year badges`);
    
    if (badgeCount > 0) {
      const firstBadge = yearBadges.first();
      const badgeStyles = await firstBadge.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
        };
      });
      console.log('✅ First year badge styles:', badgeStyles);
    }
    
    // Test 6: Check action buttons theming
    console.log('\n📋 Test 6: Action Buttons Theming');
    const actionButtons = page.locator('button:has-text("Add to Collection")');
    const buttonCount = await actionButtons.count();
    console.log(`✅ Found ${buttonCount} action buttons`);
    
    if (buttonCount > 0) {
      const firstButton = actionButtons.first();
      const buttonStyles = await firstButton.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
        };
      });
      console.log('✅ First action button styles:', buttonStyles);
    }
    
    // Test 7: Test theme switching to dark mode
    console.log('\n📋 Test 7: Theme Switching - Dark Mode');
    
    // Look for theme toggle button (could be in header or settings)
    const themeToggle = page.locator('[data-testid="theme-toggle"], button[aria-label*="theme"], .theme-toggle').first();
    
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500); // Wait for theme transition
      
      const isDarkMode = await body.evaluate(el => 
        el.classList.contains('dark-theme')
      );
      console.log(isDarkMode ? '✅ Successfully switched to dark mode' : '❌ Failed to switch to dark mode');
      
      // Re-check elements in dark mode
      const darkInputStyles = await searchInput.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          borderColor: computed.borderColor,
        };
      });
      console.log('✅ Search input in dark mode:', darkInputStyles);
      
    } else {
      console.log('⚠️  Theme toggle button not found - manual testing required');
    }
    
    // Test 8: Test search functionality
    console.log('\n📋 Test 8: Search Functionality');
    await searchInput.fill('Attack');
    await page.waitForTimeout(1000);
    
    const inputValue = await searchInput.inputValue();
    console.log(`✅ Search input value: "${inputValue}"`);
    
    // Test 9: Test hover states
    console.log('\n📋 Test 9: Hover States');
    if (cardCount > 0) {
      const firstCard = resultCards.first();
      await firstCard.hover();
      await page.waitForTimeout(200);
      console.log('✅ Hovered over first result card');
    }
    
    // Test 10: Test focus states
    console.log('\n📋 Test 10: Focus States');
    await searchInput.focus();
    await page.waitForTimeout(200);
    const isFocused = await searchInput.evaluate(el => document.activeElement === el);
    console.log(isFocused ? '✅ Search input is focused' : '❌ Search input not focused');
    
    console.log('\n🎉 Search Page Theme Testing Complete!');
    console.log('=====================================');
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  } finally {
    await browser.close();
  }
}

testSearchTheme();