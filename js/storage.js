/**
 * Storage module - handles saving/loading calculation history using localStorage
 */

const Storage = {
    STORAGE_KEY: 'utility_calculator_history',

    /**
     * Get all saved calculations
     * @returns {Array} Array of saved calculation results
     */
    getAll() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return [];
        }
    },

    /**
     * Save a calculation result
     * @param {Object} result - Calculation result from Calculator.calculate()
     */
    save(result) {
        try {
            const history = this.getAll();
            const entry = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                ...result
            };
            history.unshift(entry); // Add to beginning
            
            // Keep max 50 entries
            if (history.length > 50) {
                history.pop();
            }

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
            return entry;
        } catch (e) {
            console.error('Error saving to localStorage:', e);
            return null;
        }
    },

    /**
     * Delete a specific entry by ID
     * @param {string} id - Entry ID
     */
    delete(id) {
        try {
            const history = this.getAll();
            const filtered = history.filter(entry => entry.id !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
            return true;
        } catch (e) {
            console.error('Error deleting from localStorage:', e);
            return false;
        }
    },

    /**
     * Clear all history
     */
    clearAll() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return true;
        } catch (e) {
            console.error('Error clearing localStorage:', e);
            return false;
        }
    },

    /**
     * Format a date string for display
     * @param {string} isoDate - ISO date string
     * @returns {string} Formatted date string in Hebrew
     */
    formatDate(isoDate) {
        const date = new Date(isoDate);
        return date.toLocaleDateString('he-IL', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};
