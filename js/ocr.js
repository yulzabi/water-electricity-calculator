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
     * Process a receipt/bill image and extract total amount and consumption
     * @param {File} imageFile - The receipt image file
     * @param {string} billType - 'electricity' or 'water'
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<Object>} Extracted values
     */
    async processReceipt(imageFile, billType, onProgress) {
        if (this.isProcessing) {
            throw new Error('כבר מעבד תמונה, נא להמתין');
        }

        this.isProcessing = true;

        try {
            const imageUrl = URL.createObjectURL(imageFile);

            // Use both Hebrew and English for receipt recognition
            const result = await Tesseract.recognize(imageUrl, 'heb+eng', {
                logger: (info) => {
                    if (info.status === 'recognizing text' && onProgress) {
                        onProgress(Math.round(info.progress * 100));
                    }
                }
            });

            URL.revokeObjectURL(imageUrl);

            const extracted = this.extractReceiptData(result.data.text, billType);

            this.isProcessing = false;
            return extracted;
        } catch (error) {
            this.isProcessing = false;
            console.error('Receipt OCR Error:', error);
            throw new Error('שגיאה בזיהוי הטקסט מהחשבונית');
        }
    },

    /**
     * Extract bill amount and consumption from OCR text
     * @param {string} text - Raw OCR text from receipt
     * @param {string} billType - 'electricity' or 'water'
     * @returns {Object} Extracted data
     */
    extractReceiptData(text, billType) {
        if (!text || text.trim() === '') {
            return { found: false, totalBill: null, consumption: null, rawText: '' };
        }

        const rawText = text;

        // Normalize text
        let cleaned = text
            .replace(/\s+/g, ' ')
            .replace(/,/g, '')  // Remove commas from numbers
            .replace(/[׳']/g, "'"); // Normalize Hebrew quotes

        let totalBill = null;
        let consumption = null;

        // === Extract Total Bill Amount ===
        // Look for patterns near keywords indicating total amount
        const billPatterns = [
            // Hebrew patterns
            /(?:סה"כ\s*לתשלום|סהכ\s*לתשלום|לתשלום|סה"כ\s*חשבון|יתרה\s*לתשלום|סכום\s*לתשלום|total)\s*[:\-]?\s*₪?\s*(\d+[\.,]?\d*)/i,
            /₪\s*(\d+[\.,]?\d*)\s*(?:סה"כ|לתשלום|total)/i,
            /(\d+[\.,]\d{2})\s*₪/g, // Numbers followed by ₪
            /₪\s*(\d+[\.,]\d{2})/g, // ₪ followed by numbers
        ];

        for (const pattern of billPatterns) {
            const match = cleaned.match(pattern);
            if (match && match[1]) {
                const val = parseFloat(match[1].replace(',', '.'));
                if (val > 0 && val < 50000) { // Reasonable bill range
                    totalBill = val;
                    break;
                }
            }
        }

        // If no keyword match, find all monetary amounts and pick the largest reasonable one
        if (totalBill === null) {
            const moneyPattern = /(\d{2,6}[\.,]\d{2})/g;
            const amounts = [];
            let match;
            while ((match = moneyPattern.exec(cleaned)) !== null) {
                const val = parseFloat(match[1].replace(',', '.'));
                if (val > 10 && val < 50000) {
                    amounts.push(val);
                }
            }
            if (amounts.length > 0) {
                // Take the largest amount as likely total
                totalBill = Math.max(...amounts);
            }
        }

        // === Extract Consumption ===
        if (billType === 'electricity') {
            const consumptionPatterns = [
                /(?:צריכה|סה"כ\s*צריכה|consumption|קוט"ש|kwh|קילוואט)\s*[:\-]?\s*(\d+[\.,]?\d*)/i,
                /(\d+[\.,]?\d*)\s*(?:קוט"ש|kwh|קילוואט)/i,
            ];
            for (const pattern of consumptionPatterns) {
                const match = cleaned.match(pattern);
                if (match && match[1]) {
                    const val = parseFloat(match[1].replace(',', '.'));
                    if (val > 0 && val < 100000) {
                        consumption = val;
                        break;
                    }
                }
            }
        } else {
            // Water
            const consumptionPatterns = [
                /(?:צריכה|סה"כ\s*צריכה|consumption|מ"ק|מטר\s*מעוקב|m³|m3)\s*[:\-]?\s*(\d+[\.,]?\d*)/i,
                /(\d+[\.,]?\d*)\s*(?:מ"ק|מטר\s*מעוקב|m³|m3)/i,
            ];
            for (const pattern of consumptionPatterns) {
                const match = cleaned.match(pattern);
                if (match && match[1]) {
                    const val = parseFloat(match[1].replace(',', '.'));
                    if (val > 0 && val < 10000) {
                        consumption = val;
                        break;
                    }
                }
            }
        }

        return {
            found: totalBill !== null || consumption !== null,
            totalBill,
            consumption,
            rawText
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
