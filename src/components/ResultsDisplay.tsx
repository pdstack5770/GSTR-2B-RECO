import React from 'react';
import { ReconciliationResult, Gstr2bType } from '../types';
import { DownloadIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, DocumentDuplicateIcon, InformationCircleIcon, PartiallyMatchedIcon } from './Icons';

interface ResultsDisplayProps {
    result: ReconciliationResult;
    onDownload: (data: any[], fileName: string) => void;
    gstr2bType: Gstr2bType;
}

const StatCard: React.FC<{ title: string; value: number | string; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center space-x-4">
        <div className="text-indigo-500">{icon}</div>
        <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const DownloadButton: React.FC<{ label: string; count: number; onClick: () => void; icon: React.ReactNode; color: string; }> = ({ label, count, onClick, icon, color }) => (
    <button
        onClick={onClick}
        disabled={count === 0}
        className={`w-full flex items-center justify-between p-3 text-left rounded-lg transition-all duration-200 ${color} text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed`}
    >
        <div className="flex items-center space-x-3">
            {icon}
            <span className="font-semibold">{label}</span>
        </div>
        <span className="text-sm font-bold bg-white/30 rounded-full px-2 py-0.5">{count}</span>
    </button>
);


export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ result, onDownload, gstr2bType }) => {
    const previewData = result.finalReport.slice(0, 50);
    const headers = previewData.length > 0 ? Object.keys(previewData[0]) : [];

    const getRowClass = (status: string) => {
        switch (status) {
            case 'Matched': return 'bg-green-50';
            case 'Partially Matched': return 'bg-blue-50';
            case 'Only in Books': return 'bg-red-50';
            case 'Only in GSTR-2B': return 'bg-yellow-50';
            default: return 'bg-white';
        }
    };

    return (
        <div className="space-y-8">
            {/* Summary Stats */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-6">Reconciliation Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <StatCard title="In Books" value={result.summary.totalInBooks} icon={<DocumentDuplicateIcon />} />
                    <StatCard title="In GSTR-2B" value={result.summary.totalInGstr2b} icon={<DocumentDuplicateIcon />} />
                    <StatCard title="Matched" value={result.summary.matched} icon={<CheckCircleIcon />} />
                    <StatCard title="Partially Matched" value={result.summary.partiallyMatched} icon={<PartiallyMatchedIcon />} />
                    <StatCard title="Only in Books" value={result.summary.onlyInBooks} icon={<XCircleIcon />} />
                    <StatCard title="Only in GSTR-2B" value={result.summary.onlyInGstr2b} icon={<ExclamationTriangleIcon />} />
                </div>
            </div>

            {/* Download Section */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                 <h2 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-6">Download Reports</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     <DownloadButton
                        label="Final Reconciliation"
                        count={result.finalReport.length}
                        onClick={() => onDownload(result.finalReport, 'Final_Reconciliation_Report')}
                        icon={<DownloadIcon />}
                        color="bg-green-600 hover:bg-green-700"
                    />
                    <DownloadButton
                        label="Partially Matched"
                        count={result.partiallyMatchedRecords.length}
                        onClick={() => onDownload(result.partiallyMatchedRecords, 'Partially_Matched_Report')}
                        icon={<PartiallyMatchedIcon />}
                        color="bg-orange-500 hover:bg-orange-600"
                    />
                    <DownloadButton
                        label="Invoices in Book, not in 2B"
                        count={result.invoicesInBookNotInGstr2b.length}
                        onClick={() => onDownload(result.invoicesInBookNotInGstr2b, 'Invoices_in_Book_not_in_GSTR2B')}
                        icon={<XCircleIcon />}
                        color="bg-red-500 hover:bg-red-600"
                    />
                    <DownloadButton
                        label={`Invoices in 2B, not in Book`}
                        count={result.invoicesInGstr2bNotInBook.length}
                        onClick={() => onDownload(result.invoicesInGstr2bNotInBook, 'Invoices_in_GSTR2B_not_in_Book')}
                        icon={<ExclamationTriangleIcon />}
                        color="bg-yellow-500 hover:bg-yellow-600"
                    />
                    <DownloadButton
                        label="Credit Notes in Book, not in 2B"
                        count={result.creditNotesInBookNotInGstr2b.length}
                        onClick={() => onDownload(result.creditNotesInBookNotInGstr2b, 'CN_in_Book_not_in_GSTR2B')}
                        icon={<XCircleIcon />}
                        color="bg-purple-500 hover:bg-purple-600"
                    />
                     <DownloadButton
                        label={`Credit Notes in 2B, not in Book`}
                        count={result.creditNotesInGstr2bNotInBook.length}
                        onClick={() => onDownload(result.creditNotesInGstr2bNotInBook, 'CN_in_GSTR2B_not_in_Book')}
                        icon={<ExclamationTriangleIcon />}
                        color="bg-blue-500 hover:bg-blue-600"
                    />
                 </div>
            </div>

            {/* Preview Table */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-700 border-b pb-3 mb-6">Reconciliation Preview (First 50 Rows)</h2>
                {previewData.length > 0 ? (
                    <div className="overflow-x-auto max-h-[600px] rounded-lg border">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-100 sticky top-0 z-10">
                                <tr>
                                    {headers.map(header => (
                                        <th key={header} scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {previewData.map((row, index) => (
                                    <tr key={index} className={getRowClass(row['Recon Status'])}>
                                        {headers.map(header => (
                                            <td key={`${index}-${header}`} className="px-4 py-3 whitespace-nowrap text-gray-700">
                                                {String(row[header] ?? '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <InformationCircleIcon />
                        <p className="mt-2 text-gray-600">No data to display in the preview.</p>
                    </div>
                )}
            </div>
        </div>
    );
};