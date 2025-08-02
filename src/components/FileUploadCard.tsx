
import React from 'react';
import { UploadIcon, DocumentIcon } from './Icons';

interface FileUploadCardProps {
    title: string;
    onFileChange: (file: File | null) => void;
    file: File | null;
    acceptedFormats: string;
    children?: React.ReactNode;
}

export const FileUploadCard: React.FC<FileUploadCardProps> = ({ title, onFileChange, file, acceptedFormats, children }) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        onFileChange(selectedFile);
    };

    return (
        <div className="border border-dashed border-gray-300 rounded-lg p-6 h-full flex flex-col justify-between">
            <div>
                <h3 className="text-lg font-medium text-gray-900">{title}</h3>
                <div className="mt-4 flex flex-col items-center justify-center space-y-2 text-center">
                    {!file ? (
                        <>
                            <UploadIcon />
                            <label htmlFor={`file-upload-${title}`} className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                <span>Upload a file</span>
                                <input id={`file-upload-${title}`} name={`file-upload-${title}`} type="file" className="sr-only" onChange={handleFileChange} accept={acceptedFormats} />
                            </label>
                            <p className="text-xs text-gray-500">Accepts {acceptedFormats}</p>
                        </>
                    ) : (
                        <div className="text-center bg-gray-100 p-4 rounded-lg w-full">
                            <DocumentIcon />
                            <p className="mt-2 text-sm font-medium text-gray-700 break-all">{file.name}</p>
                            <button onClick={() => onFileChange(null)} className="mt-2 text-xs text-red-600 hover:text-red-800 font-semibold">
                                Remove
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {children && <div className="mt-auto pt-4">{children}</div>}
        </div>
    );
};
