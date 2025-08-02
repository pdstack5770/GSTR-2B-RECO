
import React, { useState, useCallback } from 'react';
import { Gstr2bType, ReconciliationResult } from './types';
import { reconcileData, exportToExcel } from './services/reconciliationService';
import { FileUploadCard } from './components/FileUploadCard';
import { ResultsDisplay } from './components/ResultsDisplay';
import { Spinner, LogoIcon } from './components/Icons';

const App: React.FC = () => {
    const [booksFile, setBooksFile] = useState<File | null>(null);
    const [gstr2bFile, setGstr2bFile] = useState<File | null>(null);
    const [gstr2bType, setGstr2bType] = useState<Gstr2bType>('B2B');
    const [reconciliationResult, setReconciliationResult] = useState<ReconciliationResult | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleReconcile = useCallback(async () => {
        if (!booksFile || !gstr2bFile) {
            setError('Please upload both files before reconciling.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setReconciliationResult(null);

        try {
            const result = await reconcileData(booksFile, gstr2bFile, gstr2bType);
            setReconciliationResult(result);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during reconciliation.');
        } finally {
            setIsLoading(false);
        }
    }, [booksFile, gstr2bFile, gstr2bType]);

    const handleDownload = (data: any[], fileName: string) => {
        if (data.length === 0) {
            alert('No data available to download for this category.');
            return;
        }
        exportToExcel(data, fileName);
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
            <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center space-x-4">
                    <LogoIcon />
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">GST Reconciliation Tool</h1>
                        <p className="text-sm sm:text-base text-indigo-200">Books vs GSTR-2B</p>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto space-y-8">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-6">Upload Your Files</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FileUploadCard
                                title="Purchase Report (Books)"
                                onFileChange={setBooksFile}
                                file={booksFile}
                                acceptedFormats=".xlsx"
                            />
                            <FileUploadCard
                                title="GSTR-2B Report"
                                onFileChange={setGstr2bFile}
                                file={gstr2bFile}
                                acceptedFormats=".xlsx"
                            >
                                <div className="mt-4">
                                    <label htmlFor="gstr2bType" className="block text-sm font-medium text-gray-600 mb-1">Report Type</label>
                                    <select
                                        id="gstr2bType"
                                        value={gstr2bType}
                                        onChange={(e) => setGstr2bType(e.target.value as Gstr2bType)}
                                        className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                                    >
                                        <option value="B2B">B2B Invoices</option>
                                        <option value="CDNR">Credit/Debit Notes (CDNR)</option>
                                        <option value="Other">Others (use first sheet)</option>
                                    </select>
                                </div>
                            </FileUploadCard>
                        </div>
                        <div className="mt-8 text-center">
                            <button
                                onClick={handleReconcile}
                                disabled={!booksFile || !gstr2bFile || isLoading}
                                className="inline-flex items-center justify-center px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300"
                            >
                                {isLoading ? (
                                    <>
                                        <Spinner />
                                        Processing...
                                    </>
                                ) : (
                                    'Reconcile Now'
                                )}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md shadow" role="alert">
                            <p className="font-bold">Error</p>
                            <p>{error}</p>
                        </div>
                    )}
                    
                    {reconciliationResult && (
                         <ResultsDisplay
                            result={reconciliationResult}
                            onDownload={handleDownload}
                            gstr2bType={gstr2bType}
                        />
                    )}
                </div>
            </main>
            <footer className="text-center py-4 mt-8">
                <p className="text-sm text-gray-500">Built with React & Tailwind CSS</p>
            </footer>
        </div>
    );
};

export default App;
