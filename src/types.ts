export type Gstr2bType = 'B2B' | 'CDNR' | 'Other';

export interface ReconciliationRecord {
    [key: string]: any; // Allows for dynamic properties from Excel files
}

export interface ReconciliationResult {
    summary: {
        totalInBooks: number;
        totalInGstr2b: number;
        matched: number;
        partiallyMatched: number;
        onlyInBooks: number;
        onlyInGstr2b: number;
    };
    matchedRecords: ReconciliationRecord[];
    partiallyMatchedRecords: ReconciliationRecord[];
    invoicesInBookNotInGstr2b: ReconciliationRecord[];
    creditNotesInBookNotInGstr2b: ReconciliationRecord[];
    invoicesInGstr2bNotInBook: ReconciliationRecord[];
    creditNotesInGstr2bNotInBook: ReconciliationRecord[];
    finalReport: ReconciliationRecord[];
}
