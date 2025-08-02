import { ReconciliationResult, Gstr2bType, ReconciliationRecord } from '../types';

declare const XLSX: any; // Using XLSX from CDN

// --- Configuration ---
const COLUMN_ALIASES = {
    gstin: ['GSTIN', 'GSTIN/UIN of Recipient', 'GSTIN of Supplier', 'Supplier GSTIN'],
    billNo: ['Invoice Number', 'Bill No', 'Bill Number', 'Document Number', 'Invoice No.', 'Inv No'],
    legalName: ['Supplier Name', 'Party Name', 'Supplier Legal Name', 'Trade/Legal name of the supplier'],
    taxableValue: ['Taxable Value (₹)', 'Taxable Value', 'Taxable Amt', 'Taxable Amount'],
    integratedTax: ['Integrated Tax(₹)', 'Integrated Tax', 'IGST', 'IGST Amt'],
    centralTax: ['Central Tax(₹)', 'Central Tax', 'CGST', 'CGST Amt'],
    stateTax: ['State/UT Tax(₹)', 'State/UT Tax', 'State Tax', 'SGST', 'SGST Amt'],
    cess: ['Cess(₹)', 'Cess', 'Cess Amt'],
};

// --- Helper Functions ---

const findHeader = (headers: string[], aliases: string[]): string | undefined => {
    for (const alias of aliases) {
        const found = headers.find(h => h.trim().toLowerCase() === alias.toLowerCase());
        if (found) return found;
    }
    return undefined;
};

const getColumnData = (row: any, header: string | undefined): number => {
    if (!header || row[header] === undefined || row[header] === null) return 0;
    // Handle numbers that might be strings with commas
    const value = parseFloat(String(row[header]).replace(/,/g, ''));
    return isNaN(value) ? 0 : value;
};

/**
 * Consolidates multiple line items for the same invoice into a single record.
 * It groups records by a composite key of GSTIN and Invoice Number, summing up
 * the values in the specified numeric columns.
 */
const consolidateInvoices = (
    records: ReconciliationRecord[],
    gstinHeader: string,
    billNoHeader: string,
    legalNameHeader: string | undefined,
    numericHeaders: (string | undefined)[]
): ReconciliationRecord[] => {
    const consolidatedMap = new Map<string, ReconciliationRecord>();
    const validNumericHeaders = numericHeaders.filter((h): h is string => !!h);

    records.forEach(record => {
        const gstin = String(record[gstinHeader] ?? '').trim().toUpperCase();
        const billNo = String(record[billNoHeader] ?? '').trim().toUpperCase();

        if (!gstin || !billNo) return; // Skip records without key identifiers

        const key = `${gstin}-${billNo}`;
        const existing = consolidatedMap.get(key);

        if (!existing) {
            // This is the first time we see this invoice, so create a new entry.
            // Ensure all numeric fields are properly parsed as numbers.
            const newRecord = { ...record };
            validNumericHeaders.forEach(header => {
                newRecord[header] = getColumnData(record, header);
            });
            consolidatedMap.set(key, newRecord);
        } else {
            // This invoice already exists, so add the current amounts to the existing record.
            validNumericHeaders.forEach(header => {
                existing[header] = (existing[header] || 0) + getColumnData(record, header);
            });
            // If the existing record was missing a legal name and the new line has it, add it.
            if(legalNameHeader && !existing[legalNameHeader] && record[legalNameHeader]){
                existing[legalNameHeader] = record[legalNameHeader];
            }
        }
    });

    return Array.from(consolidatedMap.values());
};


const parseExcelFile = (file: File, sheetName: string | undefined, fileNameForError: string): Promise<ReconciliationRecord[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                if (workbook.SheetNames.length === 0) {
                    reject(new Error(`The Excel file '${fileNameForError}' seems to be empty or corrupted as it contains no sheets.`));
                    return;
                }
                
                let targetSheetName = sheetName;
                if (!targetSheetName) {
                    targetSheetName = workbook.SheetNames[0];
                } else if (!workbook.SheetNames.includes(targetSheetName)) {
                    const foundSheet = workbook.SheetNames.find(s => s.toLowerCase().includes(sheetName!.toLowerCase()));
                    if (!foundSheet) {
                       reject(new Error(`Sheet containing '${sheetName}' not found in ${fileNameForError}. Please check the sheet name or select 'Others'.`));
                       return;
                    }
                    targetSheetName = foundSheet;
                }

                const worksheet = workbook.Sheets[targetSheetName];
                if (!worksheet) {
                    reject(new Error(`Sheet '${targetSheetName}' in ${fileNameForError} could not be found or read.`));
                    return;
                }
                
                // Convert sheet to array of arrays to find header row dynamically
                const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                if (!sheetData || sheetData.length < 1) {
                    reject(new Error(`The sheet '${targetSheetName}' in ${fileNameForError} is empty.`));
                    return;
                }

                // Find header row by looking for essential columns
                let headerRowIndex = -1;
                let headers: string[] = [];
                const requiredAliasSets = [COLUMN_ALIASES.gstin, COLUMN_ALIASES.billNo];

                for (let i = 0; i < Math.min(15, sheetData.length); i++) {
                    const row = (sheetData[i] || []).map(h => String(h || '').trim());
                    if (row.length === 0) continue;

                    let matchCount = 0;
                    for (const aliasSet of requiredAliasSets) {
                        if (row.some(cell => aliasSet.some(alias => alias.toLowerCase() === cell.toLowerCase()))) {
                            matchCount++;
                        }
                    }
                    if (matchCount >= requiredAliasSets.length) {
                        headerRowIndex = i;
                        headers = sheetData[i].map(h => String(h || '').trim());
                        break;
                    }
                }

                if (headerRowIndex === -1) {
                    reject(new Error(`Could not find a valid header row containing both GSTIN and Invoice Number columns in ${fileNameForError}. Please ensure the headers are present in the first 15 rows of the sheet.`));
                    return;
                }

                // Convert data rows to JSON using the found headers
                const dataRows = sheetData.slice(headerRowIndex + 1);
                const jsonData = dataRows
                    .map(rowArray => {
                        const record: ReconciliationRecord = {};
                        headers.forEach((header, index) => {
                            if (header && index < rowArray.length) {
                                record[header] = rowArray[index];
                            }
                        });
                        return record;
                    })
                    .filter(record => Object.values(record).some(val => val !== null && val !== ''));

                if (jsonData.length === 0) {
                     reject(new Error(`Found headers in ${fileNameForError}, but no data rows underneath.`));
                     return;
                }

                resolve(jsonData);
            } catch (err) {
                 reject(new Error(`Failed to parse ${fileNameForError}. Please ensure it is a valid .xlsx file, not password protected, and the format is correct.`));
            }
        };
        reader.onerror = () => reject(new Error(`Failed to read the file: ${fileNameForError}.`));
        reader.readAsArrayBuffer(file);
    });
};

// --- Main Reconciliation Logic ---

export const reconcileData = async (
    booksFile: File,
    gstr2bFile: File,
    gstr2bType: Gstr2bType
): Promise<ReconciliationResult> => {
    const gstr2bSheetName = gstr2bType === 'B2B' ? 'B2B' : gstr2bType === 'CDNR' ? 'CDNR' : undefined;

    const [rawBooksSheet, rawGstr2bSheet] = await Promise.all([
        parseExcelFile(booksFile, undefined, 'Purchase Report'),
        parseExcelFile(gstr2bFile, gstr2bSheetName, 'GSTR-2B Report'),
    ]);

    const bookHeaders = Object.keys(rawBooksSheet[0]);
    const gstr2bHeaders = Object.keys(rawGstr2bSheet[0]);

    // Identify actual header names from aliases
    const bookGstinH = findHeader(bookHeaders, COLUMN_ALIASES.gstin);
    const bookBillNoH = findHeader(bookHeaders, COLUMN_ALIASES.billNo);
    const bookLegalNameH = findHeader(bookHeaders, COLUMN_ALIASES.legalName);
    const bookTaxableH = findHeader(bookHeaders, COLUMN_ALIASES.taxableValue);
    const bookIgstH = findHeader(bookHeaders, COLUMN_ALIASES.integratedTax);
    const bookCgstH = findHeader(bookHeaders, COLUMN_ALIASES.centralTax);
    const bookSgstH = findHeader(bookHeaders, COLUMN_ALIASES.stateTax);
    const bookCessH = findHeader(bookHeaders, COLUMN_ALIASES.cess);
    
    const gstrGstinH = findHeader(gstr2bHeaders, COLUMN_ALIASES.gstin);
    const gstrBillNoH = findHeader(gstr2bHeaders, COLUMN_ALIASES.billNo);
    const gstrLegalNameH = findHeader(gstr2bHeaders, COLUMN_ALIASES.legalName);
    const gstrTaxableH = findHeader(gstr2bHeaders, COLUMN_ALIASES.taxableValue);
    const gstrIgstH = findHeader(gstr2bHeaders, COLUMN_ALIASES.integratedTax);
    const gstrCgstH = findHeader(gstr2bHeaders, COLUMN_ALIASES.centralTax);
    const gstrSgstH = findHeader(gstr2bHeaders, COLUMN_ALIASES.stateTax);
    const gstrCessH = findHeader(gstr2bHeaders, COLUMN_ALIASES.cess);

    if (!bookGstinH || !bookBillNoH) throw new Error('Could not find required columns (GSTIN, Invoice Number) in the Purchase Report.');
    if (!gstrGstinH || !gstrBillNoH) throw new Error('Could not find required columns (GSTIN, Invoice Number) in the GSTR-2B Report.');
    
    // Store original counts for the summary display before consolidation
    const originalTotalInBooks = rawBooksSheet.length;
    const originalTotalInGstr2b = rawGstr2bSheet.length;

    // --- Data Consolidation ---
    // Group multi-line invoices into a single entry by summing up numeric amounts.
    // This ensures a true one-to-one comparison between books and GSTR-2B.
    const bookNumericHeaders = [bookTaxableH, bookIgstH, bookCgstH, bookSgstH, bookCessH];
    const booksSheet = consolidateInvoices(rawBooksSheet, bookGstinH, bookBillNoH, bookLegalNameH, bookNumericHeaders);

    const gstrNumericHeaders = [gstrTaxableH, gstrIgstH, gstrCgstH, gstrSgstH, gstrCessH];
    const gstr2bSheet = consolidateInvoices(rawGstr2bSheet, gstrGstinH, gstrBillNoH, gstrLegalNameH, gstrNumericHeaders);

    // --- Reconciliation Step 1: Exact Match ---
    // Match based on a composite key of GSTIN and Invoice Number.
    const gstr2bMap = new Map<string, ReconciliationRecord>();
    gstr2bSheet.forEach(row => {
        const gstin = String(row[gstrGstinH!] ?? '');
        const billNo = String(row[gstrBillNoH!] ?? '');
        const key = `${gstin}${billNo}`.replace(/\s/g, '').toUpperCase();
        if (key) gstr2bMap.set(key, row);
    });
    
    const matchedRecords: ReconciliationRecord[] = [];
    const onlyInBooksInitial: ReconciliationRecord[] = [];

    booksSheet.forEach(bookRow => {
        const gstin = String(bookRow[bookGstinH!] ?? '');
        const billNo = String(bookRow[bookBillNoH!] ?? '');
        const key = `${gstin}${billNo}`.replace(/\s/g, '').toUpperCase();
        const gstrRow = gstr2bMap.get(key);

        if (gstrRow) {
            const bookTaxable = getColumnData(bookRow, bookTaxableH);
            const gstrTaxable = getColumnData(gstrRow, gstrTaxableH);
            const diffTaxable = bookTaxable - gstrTaxable;

            const bookIgst = getColumnData(bookRow, bookIgstH);
            const gstrIgst = getColumnData(gstrRow, gstrIgstH);
            const diffIgst = bookIgst - gstrIgst;

            const bookCgst = getColumnData(bookRow, bookCgstH);
            const gstrCgst = getColumnData(gstrRow, gstrCgstH);
            const diffCgst = bookCgst - gstrCgst;

            const bookSgst = getColumnData(bookRow, bookSgstH);
            const gstrSgst = getColumnData(gstrRow, gstrSgstH);
            const diffSgst = bookSgst - gstrSgst;

            const bookCess = getColumnData(bookRow, bookCessH);
            const gstrCess = getColumnData(gstrRow, gstrCessH);
            const diffCess = bookCess - gstrCess;

            const gstrRenamed = Object.fromEntries(
                Object.entries(gstrRow).map(([k, v]) => [`GSTR2B_${k}`, v])
            );

            matchedRecords.push({
                ...bookRow,
                'Recon Status': 'Matched',
                'Diff Taxable Value (₹)': Math.abs(diffTaxable) <= 2 ? '0.00' : diffTaxable.toFixed(2),
                'Diff Integrated Tax(₹)': Math.abs(diffIgst) <= 2 ? '0.00' : diffIgst.toFixed(2),
                'Diff Central Tax(₹)': Math.abs(diffCgst) <= 2 ? '0.00' : diffCgst.toFixed(2),
                'Diff State/UT Tax(₹)': Math.abs(diffSgst) <= 2 ? '0.00' : diffSgst.toFixed(2),
                'Diff Cess(₹)': Math.abs(diffCess) <= 2 ? '0.00' : diffCess.toFixed(2),
                ...gstrRenamed,
            });
            gstr2bMap.delete(key);
        } else {
            onlyInBooksInitial.push(bookRow);
        }
    });

    // --- Reconciliation Step 2: Partial Match ---
    // For records not matched exactly, try matching on GSTIN, Legal Name, and a tolerant Taxable Value.
    const partiallyMatchedRecords: ReconciliationRecord[] = [];
    const finalOnlyInBooks: ReconciliationRecord[] = [];
    const gstr2bPool = Array.from(gstr2bMap.values());

    onlyInBooksInitial.forEach(bookRow => {
        const bookGstin = String(bookRow[bookGstinH!] ?? '').replace(/\s/g, '').toUpperCase();
        const bookLegalName = bookLegalNameH ? String(bookRow[bookLegalNameH] ?? '').trim().toLowerCase() : null;
        const bookTaxable = getColumnData(bookRow, bookTaxableH);

        let matchIndex = -1;
        for (let i = 0; i < gstr2bPool.length; i++) {
            const gstrRow = gstr2bPool[i];
            const gstrGstin = String(gstrRow[gstrGstinH!] ?? '').replace(/\s/g, '').toUpperCase();
            if (bookGstin !== gstrGstin) continue;

            const gstrLegalName = gstrLegalNameH ? String(gstrRow[gstrLegalNameH] ?? '').trim().toLowerCase() : null;
            const legalNameIsMatch = (bookLegalName === null || gstrLegalName === null) || bookLegalName === gstrLegalName;
            if (!legalNameIsMatch) continue;

            const gstrTaxable = getColumnData(gstrRow, gstrTaxableH);
            if (Math.abs(bookTaxable - gstrTaxable) <= 2) {
                matchIndex = i;
                break;
            }
        }

        if (matchIndex !== -1) {
            const gstrRow = gstr2bPool[matchIndex];
            const gstrRenamed = Object.fromEntries(Object.entries(gstrRow).map(([k, v]) => [`GSTR2B_${k}`, v]));
            partiallyMatchedRecords.push({ ...bookRow, ...gstrRenamed, 'Recon Status': 'Partially Matched' });
            gstr2bPool.splice(matchIndex, 1);
        } else {
            finalOnlyInBooks.push({ ...bookRow, 'Recon Status': 'Only in Books' });
        }
    });

    const finalOnlyInGstr2b = gstr2bPool.map(row => ({ ...row, 'Recon Status': 'Only in GSTR-2B' }));

    // --- Final Reporting ---
    const bookTaxableHeader = bookTaxableH;
    const invoicesInBookNotInGstr2b = finalOnlyInBooks.filter(row => getColumnData(row, bookTaxableHeader) >= 0);
    const creditNotesInBookNotInGstr2b = finalOnlyInBooks.filter(row => getColumnData(row, bookTaxableHeader) < 0);

    const gstrTaxableHeader = gstrTaxableH;
    let invoicesInGstr2bNotInBook: ReconciliationRecord[] = [];
    let creditNotesInGstr2bNotInBook: ReconciliationRecord[] = [];
    
    if (gstr2bType === 'B2B') {
        invoicesInGstr2bNotInBook = finalOnlyInGstr2b;
    } else if (gstr2bType === 'CDNR') {
        creditNotesInGstr2bNotInBook = finalOnlyInGstr2b;
    } else { // 'Other'
        invoicesInGstr2bNotInBook = finalOnlyInGstr2b.filter(row => getColumnData(row, gstrTaxableHeader) >= 0);
        creditNotesInGstr2bNotInBook = finalOnlyInGstr2b.filter(row => getColumnData(row, gstrTaxableHeader) < 0);
    }

    const uncleanedFinalReport = [...matchedRecords, ...partiallyMatchedRecords, ...finalOnlyInBooks, ...finalOnlyInGstr2b];

    // Remove detailed tax difference columns from the final combined report for simplicity, as requested.
    const columnsToRemove = [
        'Diff Integrated Tax(₹)',
        'Diff Central Tax(₹)',
        'Diff State/UT Tax(₹)',
        'Diff Cess(₹)',
    ];

    const finalReport = uncleanedFinalReport.map(record => {
        const newRecord = { ...record };
        columnsToRemove.forEach(col => {
            delete newRecord[col];
        });
        return newRecord;
    });


    return {
        summary: {
            totalInBooks: originalTotalInBooks,
            totalInGstr2b: originalTotalInGstr2b,
            matched: matchedRecords.length,
            partiallyMatched: partiallyMatchedRecords.length,
            onlyInBooks: finalOnlyInBooks.length,
            onlyInGstr2b: finalOnlyInGstr2b.length,
        },
        matchedRecords,
        partiallyMatchedRecords,
        invoicesInBookNotInGstr2b,
        creditNotesInBookNotInGstr2b,
        invoicesInGstr2bNotInBook,
        creditNotesInGstr2bNotInBook,
        finalReport,
    };
};

export const exportToExcel = (data: ReconciliationRecord[], fileName: string) => {
    try {
        if (data.length === 0) {
            alert("No data to export for this category.");
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Reconciliation');
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    } catch (error) {
        console.error("Error exporting to Excel:", error);
        alert("An error occurred while creating the Excel file.");
    }
};