import React from 'react';

interface ApprovalRequestProps {
  requestId: string;
  toolName: string;
  toolInput: string;
  reason: string;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

export function ApprovalRequest({ 
  requestId, 
  toolName, 
  toolInput, 
  reason, 
  onApprove, 
  onReject 
}: ApprovalRequestProps) {
  return (
    <div className="bg-black/5 dark:bg-white/5 rounded-3xl p-3 my-1.5">
      <h3 className="font-medium text-sm mb-1.5">Approval Required</h3>
      <p className="text-sm text-gray-600 mb-2">The agent wants to execute a critical action:</p>
      <div className="bg-white/50 dark:bg-black/50 p-2.5 my-1.5 rounded-2xl">
        <p className="text-sm"><strong>Tool:</strong> {toolName}</p>
        <p className="text-sm"><strong>Input:</strong> {toolInput}</p>
        {reason && <p className="text-sm"><strong>Reason:</strong> {reason}</p>}
      </div>
      <div className="flex gap-2 justify-end mt-2">
        <button 
          className="px-3 py-1.5 bg-black text-white text-xs rounded-xl hover:bg-gray-800 transition-colors" 
          onClick={() => onReject(requestId)}
        >
          Reject
        </button>
        <button 
          className="px-3 py-1.5 bg-white text-black text-xs rounded-xl hover:bg-gray-100 transition-colors border border-gray-200" 
          onClick={() => onApprove(requestId)}
        >
          Approve
        </button>
      </div>
    </div>
  );
}
