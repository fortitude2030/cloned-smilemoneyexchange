import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import MobileHeader from "@/components/mobile-header";
import MobileNav from "@/components/mobile-nav";
import { apiRequest } from "@/lib/queryClient";

interface ActionDialogState {
  isOpen: boolean;
  settlementId: number | null;
  action: 'hold' | 'reject' | null;
  reason: string;
  reasonComment: string;
}

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({
    isOpen: false,
    settlementId: null,
    action: null,
    reason: '',
    reasonComment: ''
  });

  const queryClient = useQueryClient();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login';
    }
  }, [isLoading, isAuthenticated]);

  // Format currency helper
  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return 'ZMW 0';
    // Use Math.floor to truncate decimals without rounding
    const truncatedAmount = Math.floor(numAmount);
    return `ZMW ${truncatedAmount.toLocaleString()}`;
  };

  // Fetch settlement requests
  const { data: settlementRequests = [], isLoading: settlementsLoading } = useQuery({
    queryKey: ['/api/settlement-requests'],
    refetchInterval: 3000,
  });

  // Fetch transaction log
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['/api/admin/transactions'],
    refetchInterval: 3000,
  });

  // Filter pending requests (include both pending and hold status as "pending approval")
  const pendingRequests = Array.isArray(settlementRequests) ? 
    settlementRequests.filter((request: any) => request.status === 'pending' || request.status === 'hold') : [];

  // Filter and sort transactions
  const filteredTransactions = Array.isArray(transactions) ? 
    transactions.filter((transaction: any) => {
      if (priorityFilter === 'all') return true;
      return transaction.priority === priorityFilter;
    }).sort((a: any, b: any) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority as keyof typeof priorityOrder] || 2) - (priorityOrder[a.priority as keyof typeof priorityOrder] || 2);
        case 'amount':
          return parseFloat(b.amount) - parseFloat(a.amount);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    }) : [];

  // Hold settlement mutation
  const holdSettlement = useMutation({
    mutationFn: async ({ id, reason, reasonComment }: { id: number; reason: string; reasonComment?: string }) => {
      return apiRequest('PATCH', `/api/admin/settlement-requests/${id}/hold`, { holdReason: reason, reasonComment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-requests'] });
      toast({
        title: "Settlement request held successfully",
        description: "The settlement request has been placed on hold.",
      });
      setActionDialog({ isOpen: false, settlementId: null, action: null, reason: '', reasonComment: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error holding settlement request",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Reject settlement mutation
  const rejectSettlement = useMutation({
    mutationFn: async ({ id, reason, reasonComment }: { id: number; reason: string; reasonComment?: string }) => {
      return apiRequest('PATCH', `/api/admin/settlement-requests/${id}/reject`, { rejectReason: reason, reasonComment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-requests'] });
      toast({
        title: "Settlement request rejected",
        description: "The settlement request has been rejected.",
      });
      setActionDialog({ isOpen: false, settlementId: null, action: null, reason: '', reasonComment: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Error rejecting settlement request",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Approve settlement mutation
  const approveSettlement = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/admin/settlement-requests/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-breakdown'] });
      toast({
        title: "Settlement request approved",
        description: "The settlement request has been approved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error approving settlement request",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Release settlement mutation (for held settlements)
  const releaseSettlement = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/admin/settlement-requests/${id}/release`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settlement-breakdown'] });
      toast({
        title: "Settlement request released",
        description: "The settlement request has been released and approved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error releasing settlement request",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update transaction priority mutation
  const updateTransactionPriority = useMutation({
    mutationFn: async ({ id, priority }: { id: number; priority: string }) => {
      return apiRequest('PATCH', `/api/transactions/${id}/priority`, { priority });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/transactions'] });
      toast({
        title: "Priority updated",
        description: "Transaction priority has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating priority",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleOpenActionDialog = (settlementId: number, action: 'hold' | 'reject') => {
    setActionDialog({
      isOpen: true,
      settlementId,
      action,
      reason: '',
      reasonComment: ''
    });
  };

  const handleSubmitAction = async () => {
    if (!actionDialog.settlementId || !actionDialog.reason) return;

    const payload = {
      id: actionDialog.settlementId,
      reason: actionDialog.reason,
      reasonComment: actionDialog.reason === 'other' ? actionDialog.reasonComment : undefined
    };

    if (actionDialog.action === 'hold') {
      holdSettlement.mutate(payload);
    } else if (actionDialog.action === 'reject') {
      rejectSettlement.mutate(payload);
    }
  };

  const getHoldReasons = () => [
    { value: 'insufficient_documentation', label: 'Insufficient Documentation' },
    { value: 'verification_required', label: 'Additional Verification Required' },
    { value: 'compliance_review', label: 'Compliance Review Needed' },
    { value: 'other', label: 'Other (specify below)' }
  ];

  const getRejectReasons = () => [
    { value: 'invalid_documentation', label: 'Invalid Documentation' },
    { value: 'insufficient_funds', label: 'Insufficient Funds' },
    { value: 'policy_violation', label: 'Policy Violation' },
    { value: 'fraud_suspicion', label: 'Fraud Suspicion' },
    { value: 'other', label: 'Other (specify below)' }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <MobileHeader
        title="Admin Portal"
        subtitle={(user as any)?.firstName || "Admin"}
        icon="fas fa-user-shield"
        color="red-600"
      />

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="flex overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: 'fas fa-tachometer-alt' },
            { id: 'settlements', label: 'Settlements', icon: 'fas fa-university' },
            { id: 'transactions', label: 'Transactions', icon: 'fas fa-exchange-alt' },
            { id: 'analytics', label: 'Analytics', icon: 'fas fa-chart-bar' },
            { id: 'system', label: 'System', icon: 'fas fa-cogs' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <i className={`${tab.icon} mr-2`}></i>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* System Overview */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-red-600">
                        {pendingRequests.length}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">Pending Approvals</p>
                    </div>
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                      <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-400"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-green-600">
                        {Array.isArray(transactions) ? transactions.filter((t: any) => t.status === 'completed').length : 0}
                      </p>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">Completed Today</p>
                    </div>
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                      <i className="fas fa-check-circle text-green-600 dark:text-green-400"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions Overview */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-bolt text-blue-600 mr-2"></i>
                  Quick Actions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={() => setActiveTab('settlements')}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <i className="fas fa-tasks mr-2"></i>
                    View Settlements ({pendingRequests.length})
                  </Button>
                  <Button 
                    onClick={() => setActiveTab('transactions')}
                    variant="outline"
                  >
                    <i className="fas fa-list mr-2"></i>
                    Transaction Log
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Settlements Tab */}
        {activeTab === 'settlements' && (
          <>
            {/* Maker-Checker Queue */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-tasks text-red-600 mr-2"></i>
                  Settlement Management
                </h3>
                
                {settlementsLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div key={i} className="border-l-4 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-lg p-4 animate-pulse">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="w-48 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                            <div className="w-32 h-3 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                            <div className="w-24 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                          </div>
                          <div className="text-right">
                            <div className="w-20 h-6 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                            <div className="w-16 h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                          </div>
                        </div>
                        <div className="flex space-x-3">
                          <div className="flex-1 h-8 bg-gray-300 dark:bg-gray-700 rounded"></div>
                          <div className="flex-1 h-8 bg-gray-300 dark:bg-gray-700 rounded"></div>
                          <div className="flex-1 h-8 bg-gray-300 dark:bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : Array.isArray(settlementRequests) && settlementRequests.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-tasks text-gray-400 text-xl"></i>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">No settlement requests</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm">Settlement requests will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Array.isArray(settlementRequests) && settlementRequests.map((request: any) => (
                      <div key={request.id} className={`border-l-4 rounded-lg p-4 shadow-md ${
                        request.status === 'pending' ? 'border-orange-500 bg-orange-50 dark:bg-orange-950 dark:border-orange-400' :
                        request.status === 'approved' ? 'border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-400' :
                        request.status === 'hold' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-400' :
                        'border-red-500 bg-red-50 dark:bg-red-950 dark:border-red-400'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">
                              Settlement Request #{request.id}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                              {request.user?.email}
                            </p>
                            <p className="text-gray-500 dark:text-gray-500 text-xs">
                              {new Date(request.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-gray-800 dark:text-gray-200">
                              {formatCurrency(request.amount)}
                            </p>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              request.status === 'pending' ? 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200' :
                              request.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' :
                              request.status === 'held' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                              'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200'
                            }`}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          </div>
                        </div>

                        {request.status === 'pending' ? (
                          <div className="flex space-x-3">
                            <Button 
                              onClick={() => approveSettlement.mutate(request.id)}
                              disabled={approveSettlement.isPending}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-check mr-2"></i>Approve
                            </Button>
                            <Button 
                              onClick={() => handleOpenActionDialog(request.id, 'hold')}
                              disabled={holdSettlement.isPending}
                              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-pause mr-2"></i>Hold
                            </Button>
                            <Button 
                              onClick={() => handleOpenActionDialog(request.id, 'reject')}
                              disabled={rejectSettlement.isPending}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-times mr-2"></i>Reject
                            </Button>
                          </div>
                        ) : request.status === 'hold' ? (
                          <div className="flex space-x-3">
                            <Button 
                              onClick={() => releaseSettlement.mutate(request.id)}
                              disabled={releaseSettlement.isPending}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-check mr-2"></i>Release & Approve
                            </Button>
                            <Button 
                              onClick={() => handleOpenActionDialog(request.id, 'reject')}
                              disabled={rejectSettlement.isPending}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium"
                            >
                              <i className="fas fa-times mr-2"></i>Reject
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {request.reviewedBy && request.reviewedAt ? (
                                <>Processed by Admin on {new Date(request.reviewedAt).toLocaleDateString()}</>
                              ) : (
                                <>Status: {request.status.charAt(0).toUpperCase() + request.status.slice(1)}</>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <>
            {/* Filtering Controls */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Filter & Sort</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Select 
                    value={priorityFilter} 
                    onValueChange={setPriorityFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="low">Low Priority</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select 
                    value={sortBy} 
                    onValueChange={setSortBy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Sort by Date</SelectItem>
                      <SelectItem value="priority">Sort by Priority</SelectItem>
                      <SelectItem value="amount">Sort by Amount</SelectItem>
                      <SelectItem value="status">Sort by Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Transaction Log */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                  <i className="fas fa-list text-blue-600 mr-2"></i>
                  Transaction Management
                </h3>
                
                {transactionsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
                        <div className="flex items-center flex-1">
                          <div className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-lg mr-3"></div>
                          <div className="flex-1">
                            <div className="w-32 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                            <div className="w-24 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="w-20 h-4 bg-gray-300 dark:bg-gray-700 rounded mb-1"></div>
                          <div className="w-16 h-3 bg-gray-300 dark:bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : Array.isArray(transactions) && transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-list text-gray-400 text-xl"></i>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">No transactions found</p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm">Transaction history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredTransactions.slice(0, 50).map((transaction: any) => (
                      <div key={transaction.id} className={`p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 ${
                        transaction.priority === 'high' ? 'border-red-500' :
                        transaction.priority === 'medium' ? 'border-yellow-500' :
                        'border-gray-400'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center flex-1">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                              transaction.status === 'completed' ? 'bg-green-100 dark:bg-green-900' :
                              transaction.status === 'pending' ? 'bg-orange-100 dark:bg-orange-900' :
                              transaction.status === 'rejected' ? 'bg-red-100 dark:bg-red-900' :
                              'bg-gray-100 dark:bg-gray-700'
                            }`}>
                              <i className={`fas ${
                                transaction.status === 'completed' ? 'fa-check text-green-600 dark:text-green-400' :
                                transaction.status === 'pending' ? 'fa-clock text-orange-600 dark:text-orange-400' :
                                transaction.status === 'rejected' ? 'fa-times text-red-600 dark:text-red-400' :
                                'fa-circle text-gray-600 dark:text-gray-400'
                              }`}></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className={`font-medium text-sm truncate ${
                                  transaction.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                                  transaction.status === 'pending' ? 'text-orange-600 dark:text-orange-400' :
                                  transaction.status === 'rejected' ? 'text-red-600 dark:text-red-400' :
                                  'text-gray-600 dark:text-gray-400'
                                }`}>
                                  {transaction.transactionId}
                                </p>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  transaction.priority === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200' :
                                  transaction.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                }`}>
                                  {transaction.priority?.charAt(0).toUpperCase() + transaction.priority?.slice(1) || 'Medium'} Priority
                                </span>
                              </div>
                              <p className="text-gray-500 dark:text-gray-500 text-xs truncate">
                                {transaction.type === 'qr_payment' ? 'QR Payment' : 
                                 transaction.type === 'rtp' ? 'Real-time Payment' : 
                                 transaction.type || 'Transfer'} • 
                                {new Date(transaction.createdAt).toLocaleDateString()}
                              </p>
                              {transaction.description && (
                                <p className="text-gray-400 dark:text-gray-600 text-xs truncate mt-1">
                                  {transaction.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-3">
                            <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
                              {formatCurrency(transaction.amount)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              {new Date(transaction.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        
                        {/* Priority Control for Admin */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400">Priority:</span>
                            <Select 
                              value={transaction.priority || 'medium'} 
                              onValueChange={(priority) => updateTransactionPriority.mutate({ id: transaction.id, priority })}
                              disabled={updateTransactionPriority.isPending}
                            >
                              <SelectTrigger className="h-7 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              transaction.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' :
                              transaction.status === 'pending' ? 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200' :
                              transaction.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                            }`}>
                              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <>
            {/* System Analytics */}
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">System Analytics</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {Array.isArray(settlementRequests) ? settlementRequests.length : 0}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Total Requests</p>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                      {Array.isArray(settlementRequests) ? settlementRequests.filter((r) => r.status === 'approved').length : 0}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Approved</p>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-secondary">
                      {Array.isArray(settlementRequests) && settlementRequests.length > 0 ? 
                        Math.round((settlementRequests.filter((r) => r.status === 'approved').length / settlementRequests.length) * 100) : 0
                      }%
                    </p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Success Rate</p>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-primary">2.3m</p>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">Avg Process Time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <>
            <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">System Configuration</h3>
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Database Status</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Connected</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Real-time Updates</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <MobileNav
        activeTab="home"
        role="admin"
        tabs={[
          { id: "home", label: "Home", icon: "fas fa-home" },
          { id: "analytics", label: "Analytics", icon: "fas fa-chart-bar" },
          { id: "users", label: "Users", icon: "fas fa-users" },
        ]}
      />

      {/* Action Dialog for Hold/Reject */}
      <Dialog open={actionDialog.isOpen} onOpenChange={() => setActionDialog({ isOpen: false, settlementId: null, action: null, reason: '', reasonComment: '' })}>
        <DialogContent className="w-full max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-center">
              {actionDialog.action === 'hold' ? 'Hold Settlement Request' : 'Reject Settlement Request'}
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-gray-600 dark:text-gray-400">
              {actionDialog.action === 'hold' ? 'Temporarily hold this settlement request with a reason' : 'Permanently reject this settlement request with a reason'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason *</Label>
              <Select 
                value={actionDialog.reason} 
                onValueChange={(value) => setActionDialog(prev => ({ ...prev, reason: value, reasonComment: value === 'other' ? prev.reasonComment : '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {(actionDialog.action === 'hold' ? getHoldReasons() : getRejectReasons()).map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {actionDialog.reason === 'other' && (
              <div>
                <Label htmlFor="reasonComment">Comment * (125 chars max)</Label>
                <Textarea
                  id="reasonComment"
                  value={actionDialog.reasonComment}
                  onChange={(e) => setActionDialog(prev => ({ ...prev, reasonComment: e.target.value }))}
                  placeholder="Enter detailed reason..."
                  maxLength={125}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {actionDialog.reasonComment.length}/125 characters
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex space-x-3 mt-6">
            <Button 
              onClick={() => setActionDialog({ isOpen: false, settlementId: null, action: null, reason: '', reasonComment: '' })}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitAction}
              disabled={!actionDialog.reason || (actionDialog.reason === 'other' && !actionDialog.reasonComment.trim()) || holdSettlement.isPending || rejectSettlement.isPending}
              className={`flex-1 ${actionDialog.action === 'hold' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
            >
              {(holdSettlement.isPending || rejectSettlement.isPending) ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Processing...
                </>
              ) : (
                <>
                  <i className={`fas ${actionDialog.action === 'hold' ? 'fa-pause' : 'fa-times'} mr-2`}></i>
                  {actionDialog.action === 'hold' ? 'Hold' : 'Reject'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}