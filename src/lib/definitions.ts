export type Branch = {
  id: string;
  name: string;
  phoneNumber: string;
  whatsappNumber?: string;
  address: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type User = {
  id: string;
  fullName: string;
  username: string;
  password?: string;
  isActive: boolean;
  isSeller: boolean;
  permissions: string[];
  branchId?: string;
  branchName?: string;
  createdAt?: string;
  updatedAt?: string;
  // Compatibility fields
  name?: string;
  role?: 'cashier' | 'seller' | 'admin';
  status?: 'active' | 'inactive';
};

export type Customer = {
  id: string;
  name: string;
  primaryPhone: string;
  secondaryPhone?: string;
}

export type StockMovement = {
  id: string;
  date: string; // ISO string
  type: 'addition' | 'sale' | 'return' | 'initial' | 'edit' | 'rental_out' | 'rental_in';
  quantity: number; // can be + or -
  quantityBefore: number;
  quantityAfter: number;
  notes?: string;
  orderCode?: string;
  userId: string;
  userName: string;
};

export type Product = {
  id: string;
  name: string;
  productCode: string;
  category: 'rental' | 'sale' | 'both';
  price: number | string; 
  size: string;
  color?: string;
  branchId: string;
  description?: string;
  initialStock: number;
  quantityInStock: number;
  quantityRented: number;
  quantitySold: number;
  rentalCount: number;
  status: string; 
  type?: string; 
  createdAt: string; 
  updatedAt: string; 
  isGlobalProduct?: boolean; 
  isPlaceholder?: boolean;
  stockMovements?: Record<string, StockMovement>;
  costPrice?: number;
  
  // Legacy fields
  barcode?: string;
  salePrice?: number;
  rentalPrice?: number;
  group?: string;
  notes?: string;
  showInAllBranches?: boolean;
};

export type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  priceAtTimeOfOrder: number;
  originalPrice?: number; // Original price from catalog at time of order
  productCode: string;
  tailorNotes?: string | null;
  measurements?: string | null;
  itemTransactionType?: 'Sale' | 'Rental' | null;
};

export type OrderPayment = {
    id: string;
    amount: number;
    method: string;
    date: string;
    userId: string;
    userName: string;
    shiftId: string;
    note?: string;
}

export type Order = {
  id: string;
  orderCode: string;
  transactionType: string;
  customerName: string;
  customerId: string;
  customerPhone?: string;
  status: string;
  branchId: string;
  branchName: string;
  processedByUserId: string;
  processedByUserName: string;
  sellerId: string;
  sellerName: string;
  items: OrderItem[];
  total: number;
  paid: number;
  remainingAmount: number;
  deliveryDate?: string;
  returnDate?: string;
  orderDate: string;
  notes?: string;
  
  shiftId?: string; // Added to link order to a specific shift
  discountAmount?: number;
  discountApplied?: boolean;
  discountAppliedDate?: string;
  discountRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  returnCondition?: string;
  returnNotes?: string;
  updatedAt?: string;
  returnedAt?: string;
  returnStatus?: 'none' | 'partially_returned' | 'fully_returned';

  createdAt?: string | Date; // Can be string
  payments?: OrderPayment[];
};

export type Shift = {
  id: string;
  shiftCode?: string; // Sequential number
  cashier: { id: string; name: string; };
  startTime: Date | string;
  endTime?: Date | string;
  openingBalance: number;
  closingBalance?: number;
  cash: number;
  vodafoneCash: number;
  instaPay: number;
  refunds: number;
  discounts: number;
  salesTotal: number;
  rentalsTotal: number;
};

export type ShiftTransaction = {
    id: string;
    transactionCode: string;
    date: string;
    category: 'order' | 'payment' | 'discount';
    description: string;
    by: string;
    orderId: string;
    orderCode: string;
    
    // Movement details
    orderSubtotal?: number;
    discountMovement?: number;
    paymentMovement?: number;
    newRemaining: number;
    method?: string;
};

export type Expense = {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
    userId: string;
    userName: string;
    branchId: string;
    branchName: string;
    shiftId?: string; // Links expense to a specific shift
    notes?: string;
};

export type Counter = {
    id: string;
    name: string;
    prefix: string;
    value: number;
};

export type Supplier = {
    id: string;
    name: string;
    phone: string;
    address: string;
    createdAt?: string;
    updatedAt?: string;
};

export type PurchaseOrderItem = {
    productId: string;
    quantity: number;
    costPrice: number;
};

export type PurchaseOrder = {
    id: string;
    purchaseOrderCode: string;
    supplierId: string;
    supplierName: string;
    purchaseDate: string;
    items: PurchaseOrderItem[];
    totalCost: number;
    notes?: string;
    createdAt: string;
    userId: string;
    userName: string;
};

export type SaleReturnItem = {
    productId: string;
    productName: string;
    quantity: number;
    priceAtTimeOfOrder: number;
};

export type SaleReturn = {
    id: string;
    returnCode: string;
    orderId: string;
    orderCode: string;
    returnDate: string;
    items: SaleReturnItem[];
    refundAmount: number;
    createdAt: string;
    userId: string;
    userName: string;
};

export type DiscountRequest = {
  id: string;
  orderId: string;
  orderCode: string;
  orderDate: string; // The yyyy-MM-dd path segment for RTDB
  branchId: string;
  orderTotal: number;
  orderRemainingAmount: number;
  requestedByUserId: string;
  requestedByUserName: string;
  requestDate: string; // ISO
  status: 'pending' | 'approved' | 'rejected';
  approvedByUserId?: string;
  approvedByUserName?: string;
  approvalDate?: string; // ISO
  discountAmount?: number;
  rejectionReason?: string;
};