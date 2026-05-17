import { describe, it, expect } from 'vitest'
import {
  ErrorCategory,
  categorizeError,
  getErrorCategoryInfo,
  normalizeError,
} from './error-utils'

describe('Error Categorization', () => {
  describe('categorizeError', () => {
    describe('Network Errors', () => {
      it('should categorize fetch errors as NETWORK', () => {
        const error = new Error('Failed to fetch')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.NETWORK)
        expect(category.title).toBe('Connection Error')
        expect(category.icon).toBe('wifi-off')
      })

      it('should categorize connection errors as NETWORK', () => {
        const error = new Error('Network connection lost')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.NETWORK)
      })

      it('should categorize timeout errors as NETWORK', () => {
        const error = new Error('Request timeout')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.NETWORK)
      })

      it('should categorize CORS errors as NETWORK', () => {
        const error = new Error('CORS policy violation')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.NETWORK)
      })

      it('should categorize offline errors as NETWORK', () => {
        const error = new Error('Offline: No internet connection')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.NETWORK)
      })

      it('should categorize NetworkError by name as NETWORK', () => {
        const error = new Error('Custom message')
        error.name = 'NetworkError'
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.NETWORK)
      })

      it('should categorize TypeError with fetch message as NETWORK', () => {
        const error = new TypeError('Failed to fetch')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.NETWORK)
      })
    })

    describe('Rendering Errors', () => {
      it('should categorize render errors as RENDERING', () => {
        const error = new Error('Error rendering component')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.RENDERING)
        expect(category.title).toBe('Display Error')
        expect(category.icon).toBe('monitor-off')
      })

      it('should categorize DOM errors as RENDERING', () => {
        const error = new Error('DOM exception occurred')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.RENDERING)
      })

      it('should categorize hydration errors as RENDERING', () => {
        const error = new Error('Hydration failed')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.RENDERING)
      })

      it('should categorize component errors as RENDERING', () => {
        const error = new Error('Component threw an error')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.RENDERING)
      })

      it('should categorize invalid hook call errors as RENDERING', () => {
        const error = new Error('Invalid hook call')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.RENDERING)
      })

      it('should categorize DOMException by name as RENDERING', () => {
        const error = new Error('Custom message')
        error.name = 'DOMException'
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.RENDERING)
      })

      it('should categorize React stack traces as RENDERING', () => {
        const error = new Error('Component render error')
        error.stack =
          'Error: Component render error\n    at Component (/path/to/react/component.js:10:5)'
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.RENDERING)
      })

      it('should categorize Solid stack traces as RENDERING', () => {
        const error = new Error('Component render error')
        error.stack =
          'Error: Component render error\n    at Component (/path/to/solid/component.js:10:5)'
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.RENDERING)
      })
    })

    describe('User Input Errors', () => {
      it('should categorize validation errors as USER_INPUT', () => {
        const error = new Error('Validation failed')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.USER_INPUT)
        expect(category.title).toBe('Input Error')
        expect(category.icon).toBe('alert-circle')
      })

      it('should categorize invalid input errors as USER_INPUT', () => {
        const error = new Error('Invalid input format')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.USER_INPUT)
      })

      it('should categorize required field errors as USER_INPUT', () => {
        const error = new Error('Field is required')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.USER_INPUT)
      })

      it('should categorize form errors as USER_INPUT', () => {
        const error = new Error('Form submission failed')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.USER_INPUT)
      })

      it('should categorize constraint errors as USER_INPUT', () => {
        const error = new Error('Constraint violation')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.USER_INPUT)
      })

      it('should categorize TypeError with undefined as USER_INPUT', () => {
        const error = new TypeError('Cannot read property of undefined')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.USER_INPUT)
      })

      it('should categorize TypeError with null as USER_INPUT', () => {
        const error = new TypeError('Cannot read property of null')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.USER_INPUT)
      })
    })

    describe('Permission Errors', () => {
      it('should categorize permission errors as PERMISSION', () => {
        const error = new Error('Permission denied')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.PERMISSION)
        expect(category.title).toBe('Permission Error')
        expect(category.icon).toBe('shield-off')
      })

      it('should categorize unauthorized errors as PERMISSION', () => {
        const error = new Error('Unauthorized access')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.PERMISSION)
      })

      it('should categorize forbidden errors as PERMISSION', () => {
        const error = new Error('Access forbidden')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.PERMISSION)
      })

      it('should categorize authentication errors as PERMISSION', () => {
        const error = new Error('Authentication failed')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.PERMISSION)
      })

      it('should categorize login errors as PERMISSION', () => {
        const error = new Error('Login required')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.PERMISSION)
      })

      it('should categorize errors with 401 status as PERMISSION', () => {
        const error = new Error('Unauthorized') as Error & { status: number }
        error.status = 401
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.PERMISSION)
      })

      it('should categorize errors with 403 status as PERMISSION', () => {
        const error = new Error('Forbidden') as Error & { status: number }
        error.status = 403
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.PERMISSION)
      })
    })

    describe('Motion Errors', () => {
      it('should categorize animation errors as MOTION', () => {
        const error = new Error('Animation failed')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.MOTION)
        expect(category.title).toBe('Animation Error')
        expect(category.icon).toBe('zap-off')
      })

      it('should categorize motion errors as MOTION', () => {
        const error = new Error('Motion configuration error')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.MOTION)
      })

      it('should categorize transition errors as MOTION', () => {
        const error = new Error('Transition failed')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.MOTION)
      })

      it('should categorize framer motion errors as MOTION', () => {
        const error = new Error('Framer Motion error')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.MOTION)
      })

      it('should categorize gesture errors as MOTION', () => {
        const error = new Error('Gesture recognition failed')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.MOTION)
      })

      it('should categorize spring errors as MOTION', () => {
        const error = new Error('Spring animation error')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.MOTION)
      })

      it('should categorize reduced motion errors as MOTION', () => {
        const error = new Error('prefers-reduced-motion not supported')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.MOTION)
      })

      it('should categorize motion stack traces as MOTION', () => {
        const error = new Error('Something went wrong')
        error.stack =
          'Error: Something went wrong\n    at motion (/path/to/motion.js:10:5)'
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.MOTION)
      })
    })

    describe('Unknown Errors', () => {
      it('should categorize generic errors as UNKNOWN', () => {
        const error = new Error('Something went wrong')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.UNKNOWN)
        expect(category.title).toBe('Unexpected Error')
        expect(category.icon).toBe('alert-triangle')
      })

      it('should categorize empty errors as UNKNOWN', () => {
        const error = new Error('')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.UNKNOWN)
      })

      it('should categorize errors with no specific patterns as UNKNOWN', () => {
        const error = new Error('Something completely unexpected happened')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.UNKNOWN)
      })
    })

    describe('Case Sensitivity', () => {
      it('should handle case-insensitive matching', () => {
        const testCases = [
          'NETWORK ERROR',
          'Network Error',
          'network error',
          'NeTwOrK eRrOr',
        ]

        testCases.forEach((message) => {
          const error = new Error(message)
          const category = categorizeError(error)
          expect(category.category).toBe(ErrorCategory.NETWORK)
        })
      })
    })

    describe('Edge Cases', () => {
      it('should handle errors without message', () => {
        const error = new Error()
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.UNKNOWN)
      })

      it('should handle errors without stack', () => {
        const error = new Error('Test error')
        delete error.stack
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.UNKNOWN)
      })

      it('should handle errors with empty stack', () => {
        const error = new Error('Test error')
        error.stack = ''
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.UNKNOWN)
      })

      it('should prioritize more specific categories', () => {
        // Test that network errors are prioritized over unknown
        const error = new Error('Network connection failed during rendering')
        const category = categorizeError(error)
        expect(category.category).toBe(ErrorCategory.NETWORK)
      })
    })
  })

  describe('getErrorCategoryInfo', () => {
    it('should return the same result as categorizeError', () => {
      const error = new Error('Test error')
      const category1 = categorizeError(error)
      const category2 = getErrorCategoryInfo(error)
      expect(category1).toEqual(category2)
    })

    it('should work with normalized errors', () => {
      const error = normalizeError('Network error')
      const category = getErrorCategoryInfo(error)
      expect(category.category).toBe(ErrorCategory.NETWORK)
    })
  })

  describe('Error Category Information Structure', () => {
    it('should provide complete information for all categories', () => {
      const errors = [
        new Error('Network error'),
        new Error('Render error'),
        new Error('Validation error'),
        new Error('Permission denied'),
        new Error('Animation failed'),
        new Error('Random error'),
      ]

      errors.forEach((error) => {
        const category = categorizeError(error)

        expect(category).toHaveProperty('category')
        expect(category).toHaveProperty('title')
        expect(category).toHaveProperty('description')
        expect(category).toHaveProperty('recoverySuggestions')
        expect(category).toHaveProperty('icon')
        expect(category).toHaveProperty('severity')

        expect(typeof category.title).toBe('string')
        expect(typeof category.description).toBe('string')
        expect(Array.isArray(category.recoverySuggestions)).toBe(true)
        expect(typeof category.icon).toBe('string')
        expect(['low', 'medium', 'high', 'critical']).toContain(
          category.severity
        )
        expect(category.recoverySuggestions.length).toBeGreaterThan(0)
      })
    })

    it('should provide meaningful recovery suggestions', () => {
      const networkError = new Error('Network error')
      const networkCategory = categorizeError(networkError)

      expect(networkCategory.recoverySuggestions).toContain(
        'Check your internet connection'
      )
      expect(networkCategory.recoverySuggestions).toContain(
        'Try refreshing the page'
      )
    })

    it('should assign appropriate severity levels', () => {
      const testCases = [
        { error: new Error('Network error'), expectedSeverity: 'medium' },
        { error: new Error('Render error'), expectedSeverity: 'high' },
        { error: new Error('Validation error'), expectedSeverity: 'low' },
        { error: new Error('Permission denied'), expectedSeverity: 'medium' },
        { error: new Error('Animation failed'), expectedSeverity: 'low' },
        {
          error: new Error('Something completely unexpected happened'),
          expectedSeverity: 'medium',
        },
      ]

      testCases.forEach(({ error, expectedSeverity }) => {
        const category = categorizeError(error)
        expect(category.severity).toBe(expectedSeverity)
      })
    })
  })
})
