/**
 * OCR module - handles image upload and text recognition using Tesseract.js
 * Extracts meter reading numbers from uploaded images
 */

const OCR = {
    worker: null,
    isProcessing: false,

    /**
     * Process an image file and extract numbers
     * @param {File} imageFile - The image file to process
     * @param {Function} onProgress - Progress callback (0-100)
     * @returns {Promise<string>} Extracted number string
     */
    async processImage(imageFile, onProgress) {
        if (this.isProcessing) {
            throw new Error('כבר מעבד תמונה, נא להמתין');
        }

        this.isProcessing = true;

        try {
            // Create image URL
            const imageUrl = URL.createObjectURL(imageFile);

            // Use Tesseract.js to recognize text
            const result = await Tesseract.recognize(imageUrl, 'eng', {
                logger: (info) => {
                    if (info.status === 'recognizing text' && onProgress) {
                        onProgress(Math.round(info.progress * 100));
                    }
                }
            });

            // Clean up
            URL.revokeObjectURL(imageUrl);

            // Extract numbers from the recognized text
            const numbers = this.extractNumbers(result.data.text);

            this.isProcessing = false;
            return numbers;
        } catch (error) {
            this.isProcessing = false;
            console.error('OCR Error:', error);
            throw new Error('שגיאה בזיהוי הטקסט מהתמונה');
        }
    },

    /**
     * Extract the most likely meter reading number from OCR text
     * Meter readings are typically 4-8 digit numbers
     * @param {string} text - Raw OCR text
     * @returns {Object} Extracted numbers with confidence info
     */
    extractNumbers(text) {
        if (!text || text.trim() === '') {
            return { found: false, numbers: [], bestMatch: null };
        }

        // Clean up common OCR mistakes
        let cleaned = text
            .replace(/[oO]/g, '0')  // O -> 0
            .replace(/[lI|]/g, '1') // l, I, | -> 1
            .replace(/[sS]/g, '5') // S -> 5
            .replace(/[bB]/g, '8') // B -> 8
            .replace(/\s+/g, ' '); // normalize whitespace

        // Find all number sequences (4-8 digits, possibly with decimal point)
        const numberPattern = /\d{3,8}(?:\.\d{1,3})?/g;
        const matches = cleaned.match(numberPattern);

        if (!matches || matches.length === 0) {
            // Try finding any number sequences
            const simplePattern = /\d{2,}/g;
            const simpleMatches = cleaned.match(simplePattern);
            
            if (!simpleMatches || simpleMatches.length === 0) {
                return { found: false, numbers: [], bestMatch: null, rawText: text };
            }

            return {
                found: true,
                numbers: simpleMatches.map(n => parseFloat(n)),
                bestMatch: parseFloat(simpleMatches[0]),
                rawText: text
            };
        }

        // Sort by length (longer numbers are more likely to be meter readings)
        const sortedNumbers = matches
            .map(n => parseFloat(n))
            .filter(n => !isNaN(n) && n > 0)
            .sort((a, b) => b.toString().length - a.toString().length);

        return {
            found: true,
            numbers: sortedNumbers,
            bestMatch: sortedNumbers[0],
            rawText: text
        };
    },

    /**
     * Create image preview URL
     * @param {File} imageFile 
     * @returns {string} Object URL for preview
     */
    createPreviewUrl(imageFile) {
        return URL.createObjectURL(imageFile);
    }
};
