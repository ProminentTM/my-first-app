import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiCurrentUser, apiList, apiLogin, apiLogout, apiPost, clearApiSession, hasApiSession, type ApiUser } from './api'

type ModuleName = 'Launchpad' | 'Sales & Invoices' | 'Receipts' | 'Payments' | 'Supplier Bills' | 'Customers' | 'Cash Close' | 'Stock' | 'Exceptions' | 'Exchange Rates'
type Currency = 'USD' | 'ZiG'
const saleTypes = ['Cash', 'Credit', 'Part-paid'] as const
type SaleType = typeof saleTypes[number] | 'Unclassified'
const stockMovementTypes = [
  'Opening balance',
  'Goods received',
  'Issue to job/sale',
  'Return in',
  'Return to supplier',
  'Transfer in',
  'Transfer out',
  'Approved adjustment',
] as const
const exceptionStatuses = ['Open', 'In progress', 'Awaiting MD', 'Closed'] as const
type StockMovementType = typeof stockMovementTypes[number]
type ExceptionStatus = typeof exceptionStatuses[number]
type SalesDraft = {
  id: string
  invoiceNumber: string
  saleDate: string
  customerId: string | null
  customer: string
  description: string
  amount: number
  currency: Currency
  saleType: SaleType
  dueDate: string
  createdAt: string
}

const receiptSources = [
  'Same-day sale payment',
  'Debtor collection',
  'Customer deposit',
  'Loan/funding',
  'Owner contribution',
  'Transfer',
  'Other',
] as const
const receiptMethods = ['Cash', 'Bank transfer', 'POS', 'Mobile money', 'Cheque', 'Other'] as const
const receiptDestinations = ['Till USD', 'Till ZiG', 'Bank USD', 'Bank ZiG', 'POS clearing', 'Mobile money', 'Other'] as const
const paymentSpendClasses = [
  'Inventory purchase',
  'Operating expense',
  'Supplier settlement',
  'Loan repayment',
  'Capital expenditure',
  'Transfer',
  'Other',
] as const

type ReceiptSource = typeof receiptSources[number]
type ReceiptMethod = typeof receiptMethods[number]
type ReceiptDestination = typeof receiptDestinations[number]
type PaymentSpendClass = typeof paymentSpendClasses[number]
type ReceiptDraft = {
  id: string
  receiptDate: string
  receiptNumber: string
  source: ReceiptSource
  customerId: string | null
  payer: string
  invoiceId: string | null
  invoiceAllocated: string
  method: ReceiptMethod
  receivedInto: ReceiptDestination
  currency: Currency
  amount: number
  reference: string
  receivedBy: string
  notes: string
  createdAt: string
}
type PaymentDraft = {
  id: string
  paidDate: string
  voucherNumber: string
  payee: string
  spendClass: PaymentSpendClass
  category: string
  purpose: string
  sourceReference: string
  paidFrom: string
  method: ReceiptMethod
  currency: Currency
  amount: number
  approvedBy: string
  paidBy: string
  notes: string
  supplierBillId?: string | null
  supplierInvoiceNumber?: string | null
  reviewStatus?: 'pending' | 'approved' | 'rejected'
  createdBy?: string
  createdAt: string
}
type SupplierBillDraft = {
  id: string
  billDate: string
  supplierInvoiceNumber: string
  supplierName: string
  billType: 'Inventory' | 'Operating expense'
  category: string
  description: string
  sourceReference: string
  currency: Currency
  amount: number
  dueDate: string
  supplierCode: string
  enteredBy: string
  approvedBy: string
  notes: string
  reviewStatus?: 'pending' | 'approved' | 'rejected'
  createdBy?: string
  createdAt: string
}
type CustomerAccountDraft = {
  id: string
  customerCode: string
  name: string
  proposedCreditLimitUsd: number | null
  approvedCreditLimitUsd?: number | null
  creditStatus?: 'pending' | 'approved' | 'rejected'
  termsDays: number
  approvedBy: string
  approvalDate: string
  followUp: string
  createdAt: string
}
type ApiCustomer = {
  id: string
  customer_code: string
  name: string
  proposed_credit_limit_usd: string | null
  approved_credit_limit_usd: string | null
  terms_days: number
  credit_status: 'pending' | 'approved' | 'rejected'
  credit_approved_by_username: string | null
  credit_approved_at: string | null
  follow_up: string
  created_at: string
}
type ApiSalesInvoice = {
  id: string
  invoice_number: string
  sale_date: string
  customer: string | null
  customer_name: string
  description: string
  amount: string
  currency: Currency
  sale_type: Exclude<SaleType, 'Unclassified'>
  due_date: string | null
  created_at: string
}
type ApiReceipt = {
  id: string
  receipt_number: string
  receipt_date: string
  source: ReceiptSource
  customer: string | null
  payer: string
  invoice: string | null
  invoice_number: string | null
  method: ReceiptMethod
  received_into: ReceiptDestination
  currency: Currency
  amount: string
  reference: string
  received_by: string
  notes: string
  created_at: string
}
type ApiSupplierBill = {
  id: string
  supplier_invoice_number: string
  supplier_name: string
  supplier_code: string
  bill_date: string
  bill_type: SupplierBillDraft['billType']
  category: string
  description: string
  source_reference: string
  amount: string
  currency: Currency
  due_date: string | null
  entered_by: string
  notes: string
  review_status: 'pending' | 'approved' | 'rejected'
  reviewed_by_username: string | null
  created_by_username: string
  created_at: string
}
type ApiPayment = {
  id: string
  voucher_number: string
  paid_date: string
  payee: string
  spend_class: PaymentSpendClass
  category: string
  purpose: string
  source_reference: string
  paid_from: string
  method: ReceiptMethod
  amount: string
  currency: Currency
  supplier_bill: string | null
  supplier_invoice_number: string | null
  paid_by: string
  notes: string
  review_status: 'pending' | 'approved' | 'rejected'
  reviewed_by_username: string | null
  created_by_username: string
  created_at: string
}
type ApiCashClose = {
  id: string
  submission_id: string
  business_date: string
  opening_usd: string
  withdrawals_to_till_usd: string
  cash_receipts_usd: string
  cash_payments_usd: string
  deposits_to_bank_usd: string
  expected_usd: string
  actual_usd: string | null
  variance_usd: string | null
  status_usd: string
  opening_zig: string
  withdrawals_to_till_zig: string
  cash_receipts_zig: string
  cash_payments_zig: string
  deposits_to_bank_zig: string
  expected_zig: string
  actual_zig: string | null
  variance_zig: string | null
  status_zig: string
  prepared_by: string
  witness: string
  exception_reference: string
  created_at: string
}
type ApiStockMovement = {
  id: string
  submission_id: string
  movement_date: string
  item_code: string
  description: string
  location: string
  movement_type: StockMovementType
  source_reference: string
  quantity_in: string
  quantity_out: string
  unit_cost_usd: string | null
  entered_by: string
  checked_by: string
  notes: string
  created_at: string
}
type ApiExceptionUpdate = {
  id: string
  submission_id: string
  status: ExceptionStatus
  action: string
  closed_date: string | null
  reviewer_username: string
  created_at: string
}
type ApiOperationalException = {
  id: string
  submission_id: string
  exception_id: string
  raised_date: string
  area: string
  source_reference: string
  issue: string
  amount: string | null
  currency: Currency | null
  owner: string
  due_date: string
  status: ExceptionStatus
  closed_date: string | null
  updates: ApiExceptionUpdate[]
  created_at: string
}
type ApiApprovedRate = {
  id: string
  currency: Currency
  effective_date: string
  effective_to: string | null
  usd_per_unit: string
  source_reference: string
  approved_by_username: string
  created_at: string
}
type CashCloseDraft = {
  id: string
  date: string
  openingUsd: number
  withdrawalsUsd: number
  depositsUsd: number
  actualUsd: number | null
  openingZiG: number
  withdrawalsZiG: number
  depositsZiG: number
  actualZiG: number | null
  preparedBy: string
  witness: string
  exceptionRef: string
  createdAt: string
  serverSnapshot?: {
    cashReceiptsUsd: number
    cashPaymentsUsd: number
    expectedUsd: number
    varianceUsd: number | null
    statusUsd: string
    cashReceiptsZiG: number
    cashPaymentsZiG: number
    expectedZiG: number
    varianceZiG: number | null
    statusZiG: string
  }
}
type StockMovementDraft = {
  id: string
  date: string
  itemCode: string
  description: string
  location: string
  movementType: StockMovementType
  sourceReference: string
  quantityIn: number
  quantityOut: number
  unitCostUsd: number | null
  enteredBy: string
  checkedBy: string
  notes: string
  createdAt: string
}
type ExceptionUpdate = {
  id: string
  status: ExceptionStatus
  action: string
  reviewer: string
  closedDate: string
  updatedAt: string
}
type ExceptionDraft = {
  id: string
  exceptionId: string
  raisedDate: string
  area: string
  sourceReference: string
  issue: string
  amount: number | null
  currency: Currency | ''
  owner: string
  dueDate: string
  updates: ExceptionUpdate[]
  createdAt: string
  status?: ExceptionStatus
}

type SubmissionPayload = Record<string, string | number | null>
type LocalOutboxEntry = { id: string; title: string; summary: string; blockedReason?: string }

function matchesSubmissionPayload(record: object, payload: SubmissionPayload) {
  const values = record as Record<string, unknown>
  return Object.entries(payload).every(([key, expected]) => {
    const actual = values[key]
    return actual === expected
      || (typeof actual === 'string' && (typeof expected === 'string' || typeof expected === 'number') && actual === String(expected))
  })
}

async function postOrResumeSubmission<T extends { submission_id: string }>(
  path: string,
  payload: SubmissionPayload,
): Promise<T> {
  try {
    return await apiPost<T>(path, payload)
  } catch (submissionError) {
    let existing: T | undefined
    try {
      existing = (await apiList<T>(path)).find((record) => record.submission_id === payload.submission_id)
    } catch (verificationError) {
      const submissionMessage = submissionError instanceof Error ? submissionError.message : 'The submission failed.'
      const verificationMessage = verificationError instanceof Error ? verificationError.message : 'the server could not be checked.'
      throw new Error(`${submissionMessage} The server record could not be verified: ${verificationMessage}`)
    }
    if (existing && matchesSubmissionPayload(existing, payload)) return existing
    throw submissionError
  }
}

const SALES_DRAFTS_KEY = 'fentras.sales-drafts.v1'
const RECEIPT_DRAFTS_KEY = 'fentras.receipt-drafts.v1'
const PAYMENT_DRAFTS_KEY = 'fentras.payment-drafts.v1'
const SUPPLIER_BILL_DRAFTS_KEY = 'fentras.supplier-bill-drafts.v1'
const CUSTOMER_DRAFTS_KEY = 'fentras.customer-drafts.v1'
const CASH_CLOSE_DRAFTS_KEY = 'fentras.cash-close-drafts.v1'
const STOCK_MOVEMENT_DRAFTS_KEY = 'fentras.stock-movement-drafts.v1'
const EXCEPTION_DRAFTS_KEY = 'fentras.exception-drafts.v1'

const modules: { name: ModuleName; icon: string }[] = [
  { name: 'Launchpad', icon: '◎' },
  { name: 'Sales & Invoices', icon: '▤' },
  { name: 'Receipts', icon: '⇩' },
  { name: 'Payments', icon: '⇧' },
  { name: 'Supplier Bills', icon: '▧' },
  { name: 'Customers', icon: '♙' },
  { name: 'Cash Close', icon: '▦' },
  { name: 'Stock', icon: '◆' },
  { name: 'Exceptions', icon: '! ' },
  { name: 'Exchange Rates', icon: '%' },
]

export default function App() {
  const [active, setActive] = useState<ModuleName>('Launchpad')
  const [apiUser, setApiUser] = useState<ApiUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [apiDataError, setApiDataError] = useState('')
  const [apiLoading, setApiLoading] = useState(false)
  const [apiCustomers, setApiCustomers] = useState<CustomerAccountDraft[]>([])
  const [apiSales, setApiSales] = useState<SalesDraft[]>([])
  const [apiReceipts, setApiReceipts] = useState<ReceiptDraft[]>([])
  const [apiSupplierBills, setApiSupplierBills] = useState<SupplierBillDraft[]>([])
  const [apiPayments, setApiPayments] = useState<PaymentDraft[]>([])
  const [apiCashCloses, setApiCashCloses] = useState<CashCloseDraft[]>([])
  const [apiStockMovements, setApiStockMovements] = useState<StockMovementDraft[]>([])
  const [apiExceptions, setApiExceptions] = useState<ExceptionDraft[]>([])
  const [apiApprovedRates, setApiApprovedRates] = useState<ApiApprovedRate[]>([])
  const [salesDrafts, setSalesDrafts] = useState<SalesDraft[]>([])
  const [receiptDrafts, setReceiptDrafts] = useState<ReceiptDraft[]>([])
  const [paymentDrafts, setPaymentDrafts] = useState<PaymentDraft[]>([])
  const [supplierBillDrafts, setSupplierBillDrafts] = useState<SupplierBillDraft[]>([])
  const [customerDrafts, setCustomerDrafts] = useState<CustomerAccountDraft[]>([])
  const [cashCloseDrafts, setCashCloseDrafts] = useState<CashCloseDraft[]>([])
  const [stockMovementDrafts, setStockMovementDrafts] = useState<StockMovementDraft[]>([])
  const [exceptionDrafts, setExceptionDrafts] = useState<ExceptionDraft[]>([])
  const [storageError, setStorageError] = useState('')
  const [receiptStorageError, setReceiptStorageError] = useState('')
  const [paymentStorageError, setPaymentStorageError] = useState('')
  const [supplierBillStorageError, setSupplierBillStorageError] = useState('')
  const [customerStorageError, setCustomerStorageError] = useState('')
  const [cashCloseStorageError, setCashCloseStorageError] = useState('')
  const [stockStorageError, setStockStorageError] = useState('')
  const [exceptionStorageError, setExceptionStorageError] = useState('')
  const [online, setOnline] = useState(() => navigator.onLine)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    try {
      if (!hasApiSession()) {
        setAuthReady(true)
        return
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Saved sign-in data could not be read.')
      setAuthReady(true)
      return
    }

    apiCurrentUser()
      .then((user) => {
        if (!cancelled) setApiUser(user)
      })
      .catch((error: unknown) => {
        clearApiSession()
        if (!cancelled) setAuthError(error instanceof Error ? error.message : 'Your sign-in has expired.')
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!apiUser) {
      setApiCustomers([])
      setApiSales([])
      setApiReceipts([])
      setApiSupplierBills([])
      setApiPayments([])
      setApiCashCloses([])
      setApiStockMovements([])
      setApiExceptions([])
      setApiApprovedRates([])
      setApiLoading(false)
      return
    }
    let cancelled = false
    setApiLoading(true)
    setApiDataError('')
    Promise.all([
      apiList<ApiCustomer>('/api/customers/'),
      apiList<ApiSalesInvoice>('/api/sales/'),
      apiList<ApiReceipt>('/api/receipts/'),
      apiList<ApiSupplierBill>('/api/supplier-bills/'),
      apiList<ApiPayment>('/api/payments/'),
      apiList<ApiCashClose>('/api/cash-closes/'),
      apiList<ApiStockMovement>('/api/stock-movements/'),
      apiList<ApiOperationalException>('/api/exceptions/'),
      apiList<ApiApprovedRate>('/api/approved-rates/'),
    ])
      .then(([customers, sales, receipts, supplierBills, payments, cashCloses, stockMovements, exceptions, approvedRates]) => {
        if (cancelled) return
        setApiCustomers(customers.map(mapApiCustomer))
        setApiSales(sales.map(mapApiSalesInvoice))
        setApiReceipts(receipts.map(mapApiReceipt))
        setApiSupplierBills(supplierBills.map(mapApiSupplierBill))
        setApiPayments(payments.map(mapApiPayment))
        setApiCashCloses(cashCloses.map(mapApiCashClose))
        setApiStockMovements(stockMovements.map(mapApiStockMovement))
        setApiExceptions(exceptions.map(mapApiException))
        setApiApprovedRates(approvedRates)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setApiDataError(error instanceof Error ? error.message : 'Server records could not be loaded.')
        try {
          if (!hasApiSession()) setApiUser(null)
        } catch {
          setApiUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setApiLoading(false)
      })
    return () => { cancelled = true }
  }, [apiUser])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SALES_DRAFTS_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) {
        throw new Error('Saved sales drafts have an unexpected format.')
      }
      const normalized = parsed.map(normalizeSalesDraft)
      if (!normalized.every((draft): draft is SalesDraft => draft !== null)) {
        throw new Error('Saved sales drafts have an unexpected format.')
      }
      setSalesDrafts(normalized)
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Sales drafts could not be loaded.')
    }
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PAYMENT_DRAFTS_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed) || !parsed.every(isPaymentDraft)) {
        throw new Error('Saved payment drafts have an unexpected format.')
      }
      setPaymentDrafts(parsed)
    } catch (error) {
      setPaymentStorageError(error instanceof Error ? error.message : 'Payment drafts could not be loaded.')
    }
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RECEIPT_DRAFTS_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) {
        throw new Error('Saved receipt drafts have an unexpected format.')
      }
      const normalized = parsed.map(normalizeReceiptDraft)
      if (!normalized.every((draft): draft is ReceiptDraft => draft !== null)) {
        throw new Error('Saved receipt drafts have an unexpected format.')
      }
      setReceiptDrafts(normalized)
    } catch (error) {
      setReceiptStorageError(error instanceof Error ? error.message : 'Receipt drafts could not be loaded.')
    }
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SUPPLIER_BILL_DRAFTS_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed) || !parsed.every(isSupplierBillDraft)) {
        throw new Error('Saved supplier bill drafts have an unexpected format.')
      }
      setSupplierBillDrafts(parsed)
    } catch (error) {
      setSupplierBillStorageError(error instanceof Error ? error.message : 'Supplier bill drafts could not be loaded.')
    }
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CUSTOMER_DRAFTS_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed) || !parsed.every(isCustomerAccountDraft)) {
        throw new Error('Saved customer drafts have an unexpected format.')
      }
      setCustomerDrafts(parsed)
    } catch (error) {
      setCustomerStorageError(error instanceof Error ? error.message : 'Customer drafts could not be loaded.')
    }
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(CASH_CLOSE_DRAFTS_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed) || !parsed.every(isCashCloseDraft)) {
        throw new Error('Saved cash close drafts have an unexpected format.')
      }
      setCashCloseDrafts(parsed)
    } catch (error) {
      setCashCloseStorageError(error instanceof Error ? error.message : 'Cash close drafts could not be loaded.')
    }
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STOCK_MOVEMENT_DRAFTS_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed) || !parsed.every(isStockMovementDraft)) {
        throw new Error('Saved stock movements have an unexpected format.')
      }
      setStockMovementDrafts(parsed)
    } catch (error) {
      setStockStorageError(error instanceof Error ? error.message : 'Stock movements could not be loaded.')
    }
  }, [])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(EXCEPTION_DRAFTS_KEY)
      if (!saved) return
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed) || !parsed.every(isExceptionDraft)) {
        throw new Error('Saved exception drafts have an unexpected format.')
      }
      setExceptionDrafts(parsed)
    } catch (error) {
      setExceptionStorageError(error instanceof Error ? error.message : 'Exception drafts could not be loaded.')
    }
  }, [])

  function navigateTo(name: ModuleName) {
    setActive(name)
    setMobileNavOpen(false)
  }

  async function signIn(username: string, password: string) {
    setAuthBusy(true)
    setAuthError('')
    try {
      const user = await apiLogin(username, password)
      setApiUser(user)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-in failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    try {
      await apiLogout()
      setAuthError('')
    } catch (error) {
      setAuthError(`Signed out of this browser, but the server session could not be revoked: ${error instanceof Error ? error.message : 'request failed'}`)
    } finally {
      clearApiSession()
      setApiUser(null)
    }
    setApiDataError('')
  }

  async function saveSalesRecord(draft: SalesDraft) {
    if (!apiUser) {
      saveSalesDraft(draft)
      return
    }
    try {
      const created = await apiPost<ApiSalesInvoice>('/api/sales/', {
        invoice_number: draft.invoiceNumber,
        sale_date: draft.saleDate,
        customer: draft.customerId,
        customer_name: draft.customer,
        description: draft.description,
        amount: draft.amount.toFixed(2),
        currency: draft.currency,
        sale_type: draft.saleType,
        due_date: draft.dueDate || null,
      })
      setApiSales((existing) => [...existing, mapApiSalesInvoice(created)])
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The sale was not accepted by the server.')
      throw error
    }
  }

  async function saveReceiptRecord(draft: ReceiptDraft) {
    if (!apiUser) {
      saveReceiptDraft(draft)
      return
    }
    try {
      const created = await apiPost<ApiReceipt>('/api/receipts/', {
        receipt_number: draft.receiptNumber,
        receipt_date: draft.receiptDate,
        source: draft.source,
        customer: draft.customerId,
        payer: draft.payer,
        invoice: draft.invoiceId,
        method: draft.method,
        received_into: draft.receivedInto,
        currency: draft.currency,
        amount: draft.amount.toFixed(2),
        reference: draft.reference,
        received_by: draft.receivedBy,
        notes: draft.notes,
      })
      setApiReceipts((existing) => [...existing, mapApiReceipt(created)])
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The receipt was not accepted by the server.')
      throw error
    }
  }

  async function saveCustomerRecord(draft: CustomerAccountDraft) {
    if (!apiUser) {
      saveCustomerDraft(draft)
      return
    }
    try {
      const created = await apiPost<ApiCustomer>('/api/customers/', {
        customer_code: draft.customerCode,
        name: draft.name,
        proposed_credit_limit_usd: draft.proposedCreditLimitUsd?.toFixed(2) ?? null,
        terms_days: draft.termsDays,
        follow_up: draft.followUp,
      })
      setApiCustomers((existing) => [...existing, mapApiCustomer(created)])
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The customer was not accepted by the server.')
      throw error
    }
  }

  async function saveSupplierBillRecord(draft: SupplierBillDraft) {
    if (!apiUser) {
      saveSupplierBillDraft(draft)
      return
    }
    try {
      const created = await apiPost<ApiSupplierBill>('/api/supplier-bills/', {
        supplier_invoice_number: draft.supplierInvoiceNumber,
        supplier_name: draft.supplierName,
        supplier_code: draft.supplierCode,
        bill_date: draft.billDate,
        bill_type: draft.billType,
        category: draft.category,
        description: draft.description,
        source_reference: draft.sourceReference,
        amount: draft.amount.toFixed(2),
        currency: draft.currency,
        due_date: draft.dueDate || null,
        entered_by: draft.enteredBy,
        notes: draft.notes,
      })
      setApiSupplierBills((existing) => [...existing, mapApiSupplierBill(created)])
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The supplier bill was not accepted by the server.')
      throw error
    }
  }

  async function reviewSupplierBill(billId: string, decision: 'approved' | 'rejected') {
    try {
      const updated = await apiPost<ApiSupplierBill>(`/api/supplier-bills/${billId}/review/`, { decision })
      setApiSupplierBills((existing) => existing.map((bill) => bill.id === billId ? mapApiSupplierBill(updated) : bill))
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The supplier bill review was not accepted.')
      throw error
    }
  }

  async function savePaymentRecord(draft: PaymentDraft) {
    if (!apiUser) {
      savePaymentDraft(draft)
      return
    }
    try {
      const created = await apiPost<ApiPayment>('/api/payments/', {
        voucher_number: draft.voucherNumber,
        paid_date: draft.paidDate,
        payee: draft.payee,
        spend_class: draft.spendClass,
        category: draft.category,
        purpose: draft.purpose,
        source_reference: draft.sourceReference,
        paid_from: draft.paidFrom,
        method: draft.method,
        amount: draft.amount.toFixed(2),
        currency: draft.currency,
        supplier_bill: draft.supplierBillId ?? null,
        paid_by: draft.paidBy,
        notes: draft.notes,
      })
      setApiPayments((existing) => [...existing, mapApiPayment(created)])
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The payment voucher was not accepted by the server.')
      throw error
    }
  }

  async function reviewPayment(paymentId: string, decision: 'approved' | 'rejected') {
    try {
      const updated = await apiPost<ApiPayment>(`/api/payments/${paymentId}/review/`, { decision })
      setApiPayments((existing) => existing.map((payment) => payment.id === paymentId ? mapApiPayment(updated) : payment))
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The payment voucher review was not accepted.')
      throw error
    }
  }

  async function saveCashCloseRecord(draft: CashCloseDraft) {
    if (!apiUser || !navigator.onLine) {
      saveCashCloseDraft(draft)
      return
    }
    saveCashCloseDraft(draft)
    try {
      const payload: SubmissionPayload = {
        submission_id: draft.id,
        business_date: draft.date,
        opening_usd: draft.openingUsd.toFixed(2),
        withdrawals_to_till_usd: draft.depositsUsd.toFixed(2),
        deposits_to_bank_usd: draft.withdrawalsUsd.toFixed(2),
        actual_usd: draft.actualUsd?.toFixed(2) ?? null,
        opening_zig: draft.openingZiG.toFixed(2),
        withdrawals_to_till_zig: draft.depositsZiG.toFixed(2),
        deposits_to_bank_zig: draft.withdrawalsZiG.toFixed(2),
        actual_zig: draft.actualZiG?.toFixed(2) ?? null,
        prepared_by: draft.preparedBy,
        witness: draft.witness,
        exception_reference: draft.exceptionRef,
      }
      const created = await postOrResumeSubmission<ApiCashClose>('/api/cash-closes/', payload)
      setApiCashCloses((existing) => existing.some((item) => item.id === created.id)
        ? existing.map((item) => item.id === created.id ? mapApiCashClose(created) : item)
        : [...existing, mapApiCashClose(created)])
      removeCashCloseDraft(draft.id)
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The cash close was not accepted by the server.')
      throw error
    }
  }

  async function saveStockMovementRecord(draft: StockMovementDraft) {
    if (!apiUser || !navigator.onLine) {
      saveStockMovementDraft(draft)
      return
    }
    saveStockMovementDraft(draft)
    try {
      const payload: SubmissionPayload = {
        submission_id: draft.id,
        movement_date: draft.date,
        item_code: draft.itemCode,
        description: draft.description,
        location: draft.location,
        movement_type: draft.movementType,
        source_reference: draft.sourceReference,
        quantity_in: draft.quantityIn.toFixed(3),
        quantity_out: draft.quantityOut.toFixed(3),
        unit_cost_usd: draft.unitCostUsd?.toFixed(2) ?? null,
        entered_by: draft.enteredBy,
        checked_by: draft.checkedBy,
        notes: draft.notes,
      }
      const created = await postOrResumeSubmission<ApiStockMovement>('/api/stock-movements/', payload)
      setApiStockMovements((existing) => existing.some((item) => item.id === created.id)
        ? existing.map((item) => item.id === created.id ? mapApiStockMovement(created) : item)
        : [...existing, mapApiStockMovement(created)])
      removeStockMovementDraft(draft.id)
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The stock movement was not accepted by the server.')
      throw error
    }
  }

  async function saveExceptionRecord(draft: ExceptionDraft) {
    if (!apiUser || !navigator.onLine) {
      saveExceptionDraft(draft)
      return
    }
    saveExceptionDraft(draft)
    try {
      await createExceptionOnServer(draft)
      removeExceptionDraft(draft.id)
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The exception was not accepted by the server.')
      throw error
    }
  }

  async function createExceptionOnServer(draft: ExceptionDraft) {
    const payload: SubmissionPayload = {
        submission_id: draft.id,
        exception_id: draft.exceptionId,
        raised_date: draft.raisedDate,
        area: draft.area,
        source_reference: draft.sourceReference,
        issue: draft.issue,
        amount: draft.amount?.toFixed(2) ?? null,
        currency: draft.currency || null,
        owner: draft.owner,
        due_date: draft.dueDate,
      }
    const created = await postOrResumeSubmission<ApiOperationalException>('/api/exceptions/', payload)
    setApiExceptions((existing) => existing.some((item) => item.id === created.id)
      ? existing.map((item) => item.id === created.id ? mapApiException(created) : item)
      : [...existing, mapApiException(created)])
    return created
  }

  async function saveExceptionUpdateRecord(exceptionId: string, update: ExceptionUpdate) {
    if (!apiUser || exceptionDrafts.some((exception) => exception.id === exceptionId)) {
      saveExceptionUpdate(exceptionId, update)
      return
    }
    if (!navigator.onLine) throw new Error('Server exception updates require a connection. Create an offline-local exception draft instead.')
    try {
      const created = await postExceptionUpdate(exceptionId, {
        submission_id: update.id,
        status: update.status,
        action: update.action,
        closed_date: update.closedDate || null,
      })
      setApiExceptions((existing) => existing.map((exception) => exception.id === exceptionId ? {
        ...exception,
        status: created.status,
        updates: exception.updates.some((item) => item.id === created.id)
          ? exception.updates.map((item) => item.id === created.id ? mapApiExceptionUpdate(created) : item)
          : [...exception.updates, mapApiExceptionUpdate(created)],
      } : exception))
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The exception update was not accepted by the server.')
      throw error
    }
  }

  async function postExceptionUpdate(exceptionId: string, payload: SubmissionPayload) {
    try {
      return await apiPost<ApiExceptionUpdate>(`/api/exceptions/${exceptionId}/updates/`, payload)
    } catch (submissionError) {
      let existing: ApiExceptionUpdate | undefined
      try {
        const exceptions = await apiList<ApiOperationalException>('/api/exceptions/')
        existing = exceptions.find((exception) => exception.id === exceptionId)
          ?.updates.find((update) => update.submission_id === payload.submission_id)
      } catch (verificationError) {
        const submissionMessage = submissionError instanceof Error ? submissionError.message : 'The update failed.'
        const verificationMessage = verificationError instanceof Error ? verificationError.message : 'the server could not be checked.'
        throw new Error(`${submissionMessage} The update could not be verified: ${verificationMessage}`)
      }
      if (existing && matchesSubmissionPayload(existing, payload)) return existing
      throw submissionError
    }
  }

  async function saveApprovedRate(effectiveDate: string, usdPerUnit: string, sourceReference: string) {
    try {
      await apiPost<ApiApprovedRate>('/api/approved-rates/', {
        currency: 'ZiG',
        effective_date: effectiveDate,
        usd_per_unit: usdPerUnit,
        source_reference: sourceReference,
      })
      setApiApprovedRates(await apiList<ApiApprovedRate>('/api/approved-rates/'))
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The approved rate was not accepted by the server.')
      throw error
    }
  }

  async function decideCustomerCredit(customerId: string, decision: 'approved' | 'rejected', limit: string) {
    try {
      const updated = await apiPost<ApiCustomer>(`/api/customers/${customerId}/credit-decision/`, {
        decision,
        ...(decision === 'approved' ? { approved_credit_limit_usd: limit } : {}),
      })
      setApiCustomers((existing) => existing.map((customer) => customer.id === customerId ? mapApiCustomer(updated) : customer))
      setApiDataError('')
    } catch (error) {
      setApiDataError(error instanceof Error ? error.message : 'The credit decision was not accepted by the server.')
      throw error
    }
  }

  function saveSalesDraft(draft: SalesDraft) {
    if (storageError) throw new Error('Resolve the browser storage error before saving a draft.')
    const updated = [...salesDrafts, draft]
    try {
      window.localStorage.setItem(SALES_DRAFTS_KEY, JSON.stringify(updated))
      setSalesDrafts(updated)
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'Sales draft could not be saved.')
      throw error
    }
  }

  function saveReceiptDraft(draft: ReceiptDraft) {
    if (receiptStorageError) throw new Error('Resolve the browser storage error before saving a receipt.')
    const updated = [...receiptDrafts, draft]
    try {
      window.localStorage.setItem(RECEIPT_DRAFTS_KEY, JSON.stringify(updated))
      setReceiptDrafts(updated)
    } catch (error) {
      setReceiptStorageError(error instanceof Error ? error.message : 'Receipt draft could not be saved.')
      throw error
    }
  }

  function savePaymentDraft(draft: PaymentDraft) {
    if (paymentStorageError) throw new Error('Resolve the browser storage error before saving a payment.')
    const updated = [...paymentDrafts, draft]
    try {
      window.localStorage.setItem(PAYMENT_DRAFTS_KEY, JSON.stringify(updated))
      setPaymentDrafts(updated)
    } catch (error) {
      setPaymentStorageError(error instanceof Error ? error.message : 'Payment draft could not be saved.')
      throw error
    }
  }

  function saveSupplierBillDraft(draft: SupplierBillDraft) {
    if (supplierBillStorageError) throw new Error('Resolve the browser storage error before saving a supplier bill.')
    const updated = [...supplierBillDrafts, draft]
    try {
      window.localStorage.setItem(SUPPLIER_BILL_DRAFTS_KEY, JSON.stringify(updated))
      setSupplierBillDrafts(updated)
    } catch (error) {
      setSupplierBillStorageError(error instanceof Error ? error.message : 'Supplier bill draft could not be saved.')
      throw error
    }
  }

  function saveCustomerDraft(draft: CustomerAccountDraft) {
    if (customerStorageError) throw new Error('Resolve the browser storage error before saving a customer.')
    const updated = [...customerDrafts, draft]
    try {
      window.localStorage.setItem(CUSTOMER_DRAFTS_KEY, JSON.stringify(updated))
      setCustomerDrafts(updated)
    } catch (error) {
      setCustomerStorageError(error instanceof Error ? error.message : 'Customer draft could not be saved.')
      throw error
    }
  }

  function saveCashCloseDraft(draft: CashCloseDraft) {
    if (cashCloseStorageError) throw new Error('Resolve the browser storage error before saving a cash close.')
    const updated = [...cashCloseDrafts.filter((item) => item.id !== draft.id), draft]
    try {
      window.localStorage.setItem(CASH_CLOSE_DRAFTS_KEY, JSON.stringify(updated))
      setCashCloseDrafts(updated)
    } catch (error) {
      setCashCloseStorageError(error instanceof Error ? error.message : 'Cash close draft could not be saved.')
      throw error
    }
  }

  function saveStockMovementDraft(draft: StockMovementDraft) {
    if (stockStorageError) throw new Error('Resolve the browser storage error before saving a stock movement.')
    const updated = [...stockMovementDrafts.filter((item) => item.id !== draft.id), draft]
    try {
      window.localStorage.setItem(STOCK_MOVEMENT_DRAFTS_KEY, JSON.stringify(updated))
      setStockMovementDrafts(updated)
    } catch (error) {
      setStockStorageError(error instanceof Error ? error.message : 'Stock movement could not be saved.')
      throw error
    }
  }

  function saveExceptionDraft(draft: ExceptionDraft) {
    if (exceptionStorageError) throw new Error('Resolve the browser storage error before saving an exception.')
    const updated = [...exceptionDrafts.filter((item) => item.id !== draft.id), draft]
    try {
      window.localStorage.setItem(EXCEPTION_DRAFTS_KEY, JSON.stringify(updated))
      setExceptionDrafts(updated)
    } catch (error) {
      setExceptionStorageError(error instanceof Error ? error.message : 'Exception draft could not be saved.')
      throw error
    }
  }

  function saveExceptionUpdate(exceptionId: string, update: ExceptionUpdate) {
    if (exceptionStorageError) throw new Error('Resolve the browser storage error before updating an exception.')
    const existing = exceptionDrafts.find((item) => item.id === exceptionId)
    if (!existing) throw new Error('Exception was not found.')
    const updated = exceptionDrafts.map((item) => item.id === exceptionId ? { ...item, updates: [...item.updates, update] } : item)
    try {
      window.localStorage.setItem(EXCEPTION_DRAFTS_KEY, JSON.stringify(updated))
      setExceptionDrafts(updated)
    } catch (error) {
      setExceptionStorageError(error instanceof Error ? error.message : 'Exception update could not be saved.')
      throw error
    }
  }

  function removeCashCloseDraft(id: string) {
    const updated = cashCloseDrafts.filter((draft) => draft.id !== id)
    try {
      window.localStorage.setItem(CASH_CLOSE_DRAFTS_KEY, JSON.stringify(updated))
      setCashCloseDrafts(updated)
      setCashCloseStorageError('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Uploaded cash close could not be removed from local drafts.'
      setCashCloseStorageError(message)
      throw new Error(message)
    }
  }

  function removeStockMovementDraft(id: string) {
    const updated = stockMovementDrafts.filter((draft) => draft.id !== id)
    try {
      window.localStorage.setItem(STOCK_MOVEMENT_DRAFTS_KEY, JSON.stringify(updated))
      setStockMovementDrafts(updated)
      setStockStorageError('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Uploaded stock movement could not be removed from local drafts.'
      setStockStorageError(message)
      throw new Error(message)
    }
  }

  function removeExceptionDraft(id: string) {
    const updated = exceptionDrafts.filter((draft) => draft.id !== id)
    try {
      window.localStorage.setItem(EXCEPTION_DRAFTS_KEY, JSON.stringify(updated))
      setExceptionDrafts(updated)
      setExceptionStorageError('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Uploaded exception could not be removed from local drafts.'
      setExceptionStorageError(message)
      throw new Error(message)
    }
  }

  async function uploadCashCloseDraft(id: string) {
    if (!apiUser) throw new Error('Sign in before uploading a local draft.')
    if (!navigator.onLine) throw new Error('Connect to the server before uploading a local draft.')
    const draft = cashCloseDrafts.find((item) => item.id === id)
    if (!draft) throw new Error('The local cash close draft could not be found.')
    await saveCashCloseRecord(draft)
  }

  async function uploadStockMovementDraft(id: string) {
    if (!apiUser) throw new Error('Sign in before uploading a local draft.')
    if (!navigator.onLine) throw new Error('Connect to the server before uploading a local draft.')
    const draft = stockMovementDrafts.find((item) => item.id === id)
    if (!draft) throw new Error('The local stock movement draft could not be found.')
    await saveStockMovementRecord(draft)
  }

  async function uploadExceptionDraft(id: string) {
    if (!apiUser) throw new Error('Sign in before uploading a local draft.')
    if (!navigator.onLine) throw new Error('Connect to the server before uploading a local draft.')
    const draft = exceptionDrafts.find((item) => item.id === id)
    if (!draft) throw new Error('The local exception draft could not be found.')
    const created = await createExceptionOnServer(draft)
    for (const update of draft.updates) {
      const saved = await postExceptionUpdate(created.id, {
        submission_id: update.id,
        status: update.status,
        action: update.action,
        closed_date: update.closedDate || null,
      })
      setApiExceptions((existing) => existing.map((exception) => exception.id === created.id ? {
        ...exception,
        status: saved.status,
        updates: exception.updates.some((item) => item.id === saved.id)
          ? exception.updates.map((item) => item.id === saved.id ? mapApiExceptionUpdate(saved) : item)
          : [...exception.updates, mapApiExceptionUpdate(saved)],
      } : exception))
    }
    setApiDataError('')
    removeExceptionDraft(id)
  }

  const dashboardSales = apiUser ? apiSales : salesDrafts
  const dashboardReceipts = apiUser ? apiReceipts : receiptDrafts
  const today = getLocalDate()
  const todaySales = dashboardSales.filter((sale) => sale.saleDate === today)
  const todayReceipts = dashboardReceipts.filter((receipt) => receipt.receiptDate === today)
  const salesUsd = todaySales.filter((sale) => sale.currency === 'USD').reduce((total, sale) => total + sale.amount, 0)
  const salesZiG = todaySales.filter((sale) => sale.currency === 'ZiG').reduce((total, sale) => total + sale.amount, 0)
  const receiptsUsd = todayReceipts.filter((receipt) => receipt.currency === 'USD').reduce((total, receipt) => total + receipt.amount, 0)
  const receiptsZiG = todayReceipts.filter((receipt) => receipt.currency === 'ZiG').reduce((total, receipt) => total + receipt.amount, 0)
  const creditInvoices = dashboardSales.filter((sale) => sale.saleType === 'Credit' || sale.saleType === 'Part-paid')
  const outstandingUsd = creditInvoices.filter((sale) => sale.currency === 'USD').reduce((total, sale) => total + Math.max(0, getInvoiceOutstanding(sale, dashboardReceipts)), 0)
  const outstandingZiG = creditInvoices.filter((sale) => sale.currency === 'ZiG').reduce((total, sale) => total + Math.max(0, getInvoiceOutstanding(sale, dashboardReceipts)), 0)
  const dashboardExceptions = apiUser ? apiExceptions : exceptionDrafts
  const openExceptions = dashboardExceptions.filter((exception) => (exception.status ?? exception.updates[exception.updates.length - 1]?.status ?? 'Open') !== 'Closed').length
  const pendingCreditApprovals = apiCustomers.filter((customer) => customer.creditStatus === 'pending').length
  const summary = [
    { label: apiUser ? 'Server sales today' : 'Local sales today', value: `USD ${salesUsd.toFixed(2)}`, detail: `ZiG ${salesZiG.toFixed(2)} · ${todaySales.length} record(s)` },
    { label: apiUser ? 'Server receipts today' : 'Local receipts today', value: `USD ${receiptsUsd.toFixed(2)}`, detail: `ZiG ${receiptsZiG.toFixed(2)} · ${todayReceipts.length} record(s)` },
    { label: 'Open credit balance', value: `USD ${outstandingUsd.toFixed(2)}`, detail: `ZiG ${outstandingZiG.toFixed(2)} · linked invoices only` },
    { label: apiUser ? 'Server exceptions' : 'Local exceptions', value: `${openExceptions} open`, detail: apiUser ? 'Server-tracked; MD closure controls' : 'Browser-only; not reviewed by the server' },
  ]
  const recentActivity = useMemo(() => [
    ...dashboardSales.map((sale) => ({
      id: `sale-${sale.id}`,
      kind: 'sales',
      title: `${sale.saleType} sale`,
      detail: `${sale.invoiceNumber || 'Legacy sale'} · ${sale.currency} ${sale.amount.toFixed(2)}`,
      createdAt: sale.createdAt,
    })),
    ...dashboardReceipts.map((receipt) => ({
      id: `receipt-${receipt.id}`,
      kind: 'receipt',
      title: 'Customer receipt',
      detail: `${receipt.receiptNumber} · ${receipt.currency} ${receipt.amount.toFixed(2)}`,
      createdAt: receipt.createdAt,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5), [dashboardSales, dashboardReceipts])
  const dashboardCashCloses = apiUser ? apiCashCloses : cashCloseDrafts
  const latestCashClose = dashboardCashCloses.slice().sort((a, b) => b.date.localeCompare(a.date))[0]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div><strong>FENTRAS</strong><span>BRANCH WORKSPACE</span></div>
        </div>
        <nav>
          {modules.map((item) => (
            <button className={active === item.name ? 'nav-item active' : 'nav-item'} key={item.name} onClick={() => navigateTo(item.name)}>
              <span className="nav-icon">{item.icon}</span>{item.name}
            </button>
          ))}
        </nav>
        <div className="role-card">
          <label>Verified server role</label>
          <strong>{apiUser ? roleLabel(apiUser.role) : 'Not signed in'}</strong>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="menu-button" aria-label="Toggle navigation" aria-controls="mobile-navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}>☰</button>
          <div>
            <span className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <h1>{active}</h1>
          </div>
          <div className="top-actions">
            <div className={online ? 'connection online' : 'connection'}>
              <span /> {online ? 'Online' : 'Offline'}
            </div>
            <span className="sync-button" title="Local drafts are never uploaded automatically">
              Local-only records: {salesDrafts.length + receiptDrafts.length + paymentDrafts.length + supplierBillDrafts.length + customerDrafts.length + cashCloseDrafts.length + stockMovementDrafts.length + exceptionDrafts.length}
            </span>
            <AuthControls
              user={apiUser}
              ready={authReady}
              busy={authBusy}
              error={authError}
              onSignIn={signIn}
              onSignOut={signOut}
            />
          </div>
        </header>

        <nav id="mobile-navigation" className="mobile-nav" aria-label="Main navigation" hidden={!mobileNavOpen}>
          {modules.map((item) => (
            <button className={active === item.name ? 'nav-item active' : 'nav-item'} key={item.name} onClick={() => navigateTo(item.name)}>
              <span className="nav-icon">{item.icon}</span>{item.name}
            </button>
          ))}
        </nav>

        {(apiDataError || storageError || receiptStorageError || paymentStorageError || supplierBillStorageError || customerStorageError || cashCloseStorageError || stockStorageError || exceptionStorageError) && (
          <div className="storage-error" role="alert">{[apiDataError, storageError, receiptStorageError, paymentStorageError, supplierBillStorageError, customerStorageError, cashCloseStorageError, stockStorageError, exceptionStorageError].filter(Boolean).join(' ')}</div>
        )}

        {active === 'Launchpad' ? (
          <div className="content">
            <section className="welcome">
              <div>
                <span className="eyebrow">GOOD MORNING</span>
                <h2>Branch control overview</h2>
              </div>
              <button className="primary" onClick={() => navigateTo('Sales & Invoices')}>+ New transaction</button>
            </section>

            <section className="summary-grid">
              {summary.map((card) => (
                <article className="summary-card" key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.detail}</small>
                </article>
              ))}
            </section>

            <section className="dashboard-grid">
              <article className="panel">
                <div className="panel-head"><div><span>OPERATIONS</span><h3>Recent activity</h3></div><button>View report</button></div>
                <div className="activity">
                  {recentActivity.length === 0 ? <p className="empty-drafts">No sales or receipts in this view yet.</p> : recentActivity.map((item) => (
                    <div key={item.id}>
                      <span className={`activity-icon ${item.kind}`}>{item.kind === 'sales' ? 'S' : 'R'}</span>
                      <p><strong>{item.title}</strong><small>{item.detail}</small></p>
                      <time>{new Date(item.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</time>
                    </div>
                  ))}
                </div>
              </article>

              <article className="panel close-panel">
                <div className="panel-head"><div><span>CLOSING</span><h3>Daily cash close</h3></div></div>
                <div className="close-status"><span className="status-ring">{apiUser ? 'Server' : 'Local'}</span><p><strong>{dashboardCashCloses.length} {apiUser ? 'server' : 'browser-local'} close(s)</strong><small>{latestCashClose ? `Latest date ${latestCashClose.date}` : 'No close recorded'}</small></p></div>
                <button className="secondary" onClick={() => navigateTo('Cash Close')}>Continue closing</button>
              </article>
            </section>

            {apiUser?.role === 'managing_director' && (
              <section className="notice"><strong>Management review</strong><span>{pendingCreditApprovals} server customer credit request(s) pending.</span><button onClick={() => navigateTo('Customers')}>Review customers</button></section>
            )}
          </div>
        ) : active === 'Sales & Invoices' ? (
          <SalesInvoicesView
            drafts={apiUser ? apiSales : salesDrafts}
            localDrafts={apiUser ? salesDrafts : []}
            customers={apiUser ? apiCustomers : customerDrafts}
            connected={Boolean(apiUser)}
            loading={apiLoading}
            onSaveDraft={saveSalesRecord}
          />
        ) : active === 'Receipts' ? (
          <ReceiptsView
            drafts={apiUser ? apiReceipts : receiptDrafts}
            localDrafts={apiUser ? receiptDrafts : []}
            sales={apiUser ? apiSales : salesDrafts}
            customers={apiUser ? apiCustomers : customerDrafts}
            connected={Boolean(apiUser)}
            loading={apiLoading}
            onSaveDraft={saveReceiptRecord}
          />
        ) : active === 'Payments' ? (
          <PaymentsView
            drafts={apiUser ? apiPayments : paymentDrafts}
            localDrafts={apiUser ? paymentDrafts : []}
            supplierBills={apiUser ? apiSupplierBills : []}
            connected={Boolean(apiUser)}
            loading={apiLoading}
            role={apiUser?.role ?? null}
            username={apiUser?.username ?? ''}
            onSaveDraft={savePaymentRecord}
            onReview={reviewPayment}
          />
        ) : active === 'Supplier Bills' ? (
          <SupplierBillsView
            drafts={apiUser ? apiSupplierBills : supplierBillDrafts}
            localDrafts={apiUser ? supplierBillDrafts : []}
            connected={Boolean(apiUser)}
            loading={apiLoading}
            role={apiUser?.role ?? null}
            username={apiUser?.username ?? ''}
            onSaveDraft={saveSupplierBillRecord}
            onReview={reviewSupplierBill}
          />
        ) : active === 'Customers' ? (
          <CustomersView
            drafts={apiUser ? apiCustomers : customerDrafts}
            localDrafts={apiUser ? customerDrafts : []}
            sales={apiUser ? apiSales : salesDrafts}
            receipts={apiUser ? apiReceipts : receiptDrafts}
            connected={Boolean(apiUser)}
            loading={apiLoading}
            role={apiUser?.role ?? null}
            onSaveDraft={saveCustomerRecord}
            onCreditDecision={decideCustomerCredit}
          />
        ) : active === 'Cash Close' ? (
          <CashCloseView
            drafts={apiUser ? apiCashCloses : cashCloseDrafts}
            localDrafts={apiUser ? cashCloseDrafts : []}
            receipts={dashboardReceipts}
            payments={apiUser ? apiPayments.filter((payment) => payment.reviewStatus === 'approved') : paymentDrafts}
            connected={Boolean(apiUser)}
            online={online}
            loading={apiLoading}
            onSaveDraft={saveCashCloseRecord}
            onUploadDraft={uploadCashCloseDraft}
            onDismissDraft={removeCashCloseDraft}
          />
        ) : active === 'Stock' ? (
          <StockControlView
            drafts={apiUser ? apiStockMovements : stockMovementDrafts}
            localDrafts={apiUser ? stockMovementDrafts : []}
            connected={Boolean(apiUser)}
            online={online}
            loading={apiLoading}
            onSaveDraft={saveStockMovementRecord}
            onUploadDraft={uploadStockMovementDraft}
            onDismissDraft={removeStockMovementDraft}
          />
        ) : active === 'Exceptions' ? (
          <ExceptionsView
            drafts={apiUser ? apiExceptions : exceptionDrafts}
            localDrafts={apiUser ? exceptionDrafts : []}
            connected={Boolean(apiUser)}
            online={online}
            loading={apiLoading}
            role={apiUser?.role ?? null}
            username={apiUser?.username ?? ''}
            onSaveDraft={saveExceptionRecord}
            onSaveUpdate={saveExceptionUpdateRecord}
            onUploadDraft={uploadExceptionDraft}
            onDismissDraft={removeExceptionDraft}
          />
        ) : active === 'Exchange Rates' ? (
          <ExchangeRatesView
            rates={apiApprovedRates}
            connected={Boolean(apiUser)}
            loading={apiLoading}
            role={apiUser?.role ?? null}
            onSaveRate={saveApprovedRate}
          />
        ) : (
          <ModuleView name={active} />
        )}
      </main>
    </div>
  )
}

function roleLabel(role: ApiUser['role']) {
  if (role === 'managing_director') return 'Managing Director'
  if (role === 'branch_manager') return 'Branch Manager'
  return 'No assigned role'
}

function mapApiCustomer(record: ApiCustomer): CustomerAccountDraft {
  return {
    id: record.id,
    customerCode: record.customer_code,
    name: record.name,
    proposedCreditLimitUsd: record.proposed_credit_limit_usd === null ? null : Number(record.proposed_credit_limit_usd),
    approvedCreditLimitUsd: record.approved_credit_limit_usd === null ? null : Number(record.approved_credit_limit_usd),
    creditStatus: record.credit_status,
    termsDays: record.terms_days,
    approvedBy: record.credit_approved_by_username ?? '',
    approvalDate: record.credit_approved_at?.slice(0, 10) ?? '',
    followUp: record.follow_up,
    createdAt: record.created_at,
  }
}

function mapApiSalesInvoice(record: ApiSalesInvoice): SalesDraft {
  return {
    id: record.id,
    invoiceNumber: record.invoice_number,
    saleDate: record.sale_date,
    customerId: record.customer,
    customer: record.customer_name,
    description: record.description,
    amount: Number(record.amount),
    currency: record.currency,
    saleType: record.sale_type,
    dueDate: record.due_date ?? '',
    createdAt: record.created_at,
  }
}

function mapApiReceipt(record: ApiReceipt): ReceiptDraft {
  return {
    id: record.id,
    receiptDate: record.receipt_date,
    receiptNumber: record.receipt_number,
    source: record.source,
    customerId: record.customer,
    payer: record.payer,
    invoiceId: record.invoice,
    invoiceAllocated: record.invoice_number ?? '',
    method: record.method,
    receivedInto: record.received_into,
    currency: record.currency,
    amount: Number(record.amount),
    reference: record.reference,
    receivedBy: record.received_by,
    notes: record.notes,
    createdAt: record.created_at,
  }
}

function mapApiSupplierBill(record: ApiSupplierBill): SupplierBillDraft {
  return {
    id: record.id,
    billDate: record.bill_date,
    supplierInvoiceNumber: record.supplier_invoice_number,
    supplierName: record.supplier_name,
    billType: record.bill_type,
    category: record.category,
    description: record.description,
    sourceReference: record.source_reference,
    currency: record.currency,
    amount: Number(record.amount),
    dueDate: record.due_date ?? '',
    supplierCode: record.supplier_code,
    enteredBy: record.entered_by,
    approvedBy: record.reviewed_by_username ?? '',
    notes: record.notes,
    reviewStatus: record.review_status,
    createdBy: record.created_by_username,
    createdAt: record.created_at,
  }
}

function mapApiPayment(record: ApiPayment): PaymentDraft {
  return {
    id: record.id,
    paidDate: record.paid_date,
    voucherNumber: record.voucher_number,
    payee: record.payee,
    spendClass: record.spend_class,
    category: record.category,
    purpose: record.purpose,
    sourceReference: record.source_reference,
    paidFrom: record.paid_from,
    method: record.method,
    currency: record.currency,
    amount: Number(record.amount),
    approvedBy: record.reviewed_by_username ?? '',
    paidBy: record.paid_by,
    notes: record.notes,
    supplierBillId: record.supplier_bill,
    supplierInvoiceNumber: record.supplier_invoice_number,
    reviewStatus: record.review_status,
    createdBy: record.created_by_username,
    createdAt: record.created_at,
  }
}

function mapApiCashClose(record: ApiCashClose): CashCloseDraft {
  return {
    id: record.id,
    date: record.business_date,
    openingUsd: Number(record.opening_usd),
    withdrawalsUsd: Number(record.deposits_to_bank_usd),
    depositsUsd: Number(record.withdrawals_to_till_usd),
    actualUsd: record.actual_usd === null ? null : Number(record.actual_usd),
    openingZiG: Number(record.opening_zig),
    withdrawalsZiG: Number(record.deposits_to_bank_zig),
    depositsZiG: Number(record.withdrawals_to_till_zig),
    actualZiG: record.actual_zig === null ? null : Number(record.actual_zig),
    preparedBy: record.prepared_by,
    witness: record.witness,
    exceptionRef: record.exception_reference,
    createdAt: record.created_at,
    serverSnapshot: {
      cashReceiptsUsd: Number(record.cash_receipts_usd),
      cashPaymentsUsd: Number(record.cash_payments_usd),
      expectedUsd: Number(record.expected_usd),
      varianceUsd: record.variance_usd === null ? null : Number(record.variance_usd),
      statusUsd: record.status_usd,
      cashReceiptsZiG: Number(record.cash_receipts_zig),
      cashPaymentsZiG: Number(record.cash_payments_zig),
      expectedZiG: Number(record.expected_zig),
      varianceZiG: record.variance_zig === null ? null : Number(record.variance_zig),
      statusZiG: record.status_zig,
    },
  }
}

function mapApiStockMovement(record: ApiStockMovement): StockMovementDraft {
  return {
    id: record.id,
    date: record.movement_date,
    itemCode: record.item_code,
    description: record.description,
    location: record.location,
    movementType: record.movement_type,
    sourceReference: record.source_reference,
    quantityIn: Number(record.quantity_in),
    quantityOut: Number(record.quantity_out),
    unitCostUsd: record.unit_cost_usd === null ? null : Number(record.unit_cost_usd),
    enteredBy: record.entered_by,
    checkedBy: record.checked_by,
    notes: record.notes,
    createdAt: record.created_at,
  }
}

function mapApiExceptionUpdate(record: ApiExceptionUpdate): ExceptionUpdate {
  return {
    id: record.id,
    status: record.status,
    action: record.action,
    reviewer: record.reviewer_username,
    closedDate: record.closed_date ?? '',
    updatedAt: record.created_at,
  }
}

function mapApiException(record: ApiOperationalException): ExceptionDraft {
  return {
    id: record.id,
    exceptionId: record.exception_id,
    raisedDate: record.raised_date,
    area: record.area,
    sourceReference: record.source_reference,
    issue: record.issue,
    amount: record.amount === null ? null : Number(record.amount),
    currency: record.currency ?? '',
    owner: record.owner,
    dueDate: record.due_date,
    updates: record.updates.map(mapApiExceptionUpdate),
    createdAt: record.created_at,
    status: record.status,
  }
}

function AuthControls({
  user,
  ready,
  busy,
  error,
  onSignIn,
  onSignOut,
}: {
  user: ApiUser | null
  ready: boolean
  busy: boolean
  error: string
  onSignIn: (username: string, password: string) => Promise<void>
  onSignOut: () => void | Promise<void>
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (user) {
    return (
      <div className="auth-user">
        <span>{user.username} · {roleLabel(user.role)}</span>
        <button className="secondary" type="button" onClick={() => { void onSignOut() }}>Sign out</button>
      </div>
    )
  }
  if (!ready) return <span className="auth-loading">Checking sign-in…</span>

  return (
    <details className="auth-menu">
      <summary className="secondary">Sign in</summary>
      <form className="auth-form" onSubmit={async (event) => {
        event.preventDefault()
        await onSignIn(username.trim(), password)
        setPassword('')
      }}>
        <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </details>
  )
}

function LocalDraftNotice({ label, count, children }: { label: string; count: number; children: string[] }) {
  return (
    <article className="panel local-draft-notice">
      <div className="panel-head"><div><span>NOT UPLOADED</span><h3>Browser-local {label} drafts <small>{count}</small></h3></div></div>
      <ul>{children.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
      <p className="form-note">These pre-existing drafts were preserved and are not submitted automatically. Review and enter them as server records only if they have not already been recorded from source documents.</p>
    </article>
  )
}

function LocalDraftOutbox({
  label,
  entries,
  online,
  onUpload,
  onDismiss,
}: {
  label: string
  entries: LocalOutboxEntry[]
  online: boolean
  onUpload: (id: string) => Promise<void>
  onDismiss: (id: string) => void
}) {
  const [uploadingId, setUploadingId] = useState('')
  const [error, setError] = useState('')

  async function upload(id: string) {
    setUploadingId(id)
    setError('')
    try {
      await onUpload(id)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The draft was not uploaded and remains on this device.')
    } finally {
      setUploadingId('')
    }
  }

  function dismiss(entry: LocalOutboxEntry) {
    if (!window.confirm(`Remove the local copy of "${entry.title}"? This cannot be undone and does not change server records.`)) return
    try {
      onDismiss(entry.id)
      setError('')
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : 'The local draft could not be removed.')
    }
  }

  return (
    <article className="panel local-draft-notice">
      <div className="panel-head"><div><span>MANUAL UPLOAD ONLY</span><h3>Local {label} outbox <small>{entries.length}</small></h3></div></div>
      <ul className="outbox-list">
        {entries.map((entry) => (
          <li className="outbox-row" key={entry.id}>
            <div><strong>{entry.title}</strong><small>{entry.summary}</small></div>
            <div className="outbox-actions">
              <button
                className="secondary"
                type="button"
                disabled={!online || Boolean(entry.blockedReason) || Boolean(uploadingId)}
                onClick={() => { void upload(entry.id) }}
                title={entry.blockedReason}
              >
                {uploadingId === entry.id ? 'Uploading…' : entry.blockedReason ? 'MD sign-in required' : online ? 'Review & upload' : 'Offline'}
              </button>
              <button className="secondary" type="button" disabled={Boolean(uploadingId)} onClick={() => dismiss(entry)}>
                Remove local copy
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!online && <p className="form-note">The server is unreachable. These drafts remain stored on this device.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="form-note">Nothing is uploaded automatically. Review each draft and its source documents before choosing Review &amp; upload. Server validation applies; conflicts stay here until corrected or explicitly removed after review.</p>
    </article>
  )
}

function CreditDecisionControls({
  customer,
  onDecision,
}: {
  customer: CustomerAccountDraft
  onDecision: (customerId: string, decision: 'approved' | 'rejected', limit: string) => Promise<void>
}) {
  const [limit, setLimit] = useState(customer.proposedCreditLimitUsd?.toFixed(2) ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function decide(decision: 'approved' | 'rejected') {
    if (decision === 'approved' && (!limit || !Number.isFinite(Number(limit)) || Number(limit) < 0)) {
      setError('Enter a non-negative approved USD limit.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onDecision(customer.id, decision, limit)
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Credit decision failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="credit-decision">
      <label>Approved USD limit<input type="number" value={limit} onChange={(event) => setLimit(event.target.value)} min="0" step="0.01" /></label>
      <div>
        <button className="secondary" type="button" disabled={saving} onClick={() => decide('rejected')}>Reject</button>
        <button className="primary" type="button" disabled={saving} onClick={() => decide('approved')}>{saving ? 'Saving…' : 'Approve'}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}

function ReviewActions({
  onDecision,
}: {
  onDecision: (decision: 'approved' | 'rejected') => Promise<void>
}) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function decide(decision: 'approved' | 'rejected') {
    setSaving(true)
    setError('')
    try {
      await onDecision(decision)
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Review could not be recorded.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="credit-decision">
      <div>
        <button className="secondary" type="button" disabled={saving} onClick={() => { void decide('rejected') }}>Reject</button>
        <button className="primary" type="button" disabled={saving} onClick={() => { void decide('approved') }}>{saving ? 'Saving…' : 'Approve'}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}

function normalizeSalesDraft(value: unknown): SalesDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as Record<string, unknown>
  const saleType = draft.saleType === undefined
    ? 'Unclassified'
    : draft.saleType === 'Unclassified' ? 'Unclassified' : saleTypes.find((item) => item === draft.saleType)
  const invoiceNumber = draft.invoiceNumber === undefined ? '' : draft.invoiceNumber
  const saleDate = draft.saleDate === undefined && typeof draft.createdAt === 'string' ? draft.createdAt.slice(0, 10) : draft.saleDate
  const customerId = draft.customerId === undefined ? null : draft.customerId
  const dueDate = draft.dueDate === undefined ? '' : draft.dueDate
  if (typeof draft.id !== 'string'
    || typeof invoiceNumber !== 'string'
    || typeof saleDate !== 'string'
    || (customerId !== null && typeof customerId !== 'string')
    || typeof draft.customer !== 'string'
    || typeof draft.description !== 'string'
    || typeof draft.amount !== 'number'
    || (draft.currency !== 'USD' && draft.currency !== 'ZiG')
    || !saleType
    || typeof dueDate !== 'string'
    || typeof draft.createdAt !== 'string') return null
  return {
    id: draft.id,
    invoiceNumber,
    saleDate,
    customerId,
    customer: draft.customer,
    description: draft.description,
    amount: draft.amount,
    currency: draft.currency,
    saleType,
    dueDate,
    createdAt: draft.createdAt,
  }
}

function normalizeReceiptDraft(value: unknown): ReceiptDraft | null {
  if (!value || typeof value !== 'object') return null
  const draft = value as Record<string, unknown>
  const customerId = draft.customerId === undefined ? null : draft.customerId
  const invoiceId = draft.invoiceId === undefined ? null : draft.invoiceId
  const source = receiptSources.find((item) => item === draft.source)
  const method = receiptMethods.find((item) => item === draft.method)
  const receivedInto = receiptDestinations.find((item) => item === draft.receivedInto)
  if (typeof draft.id !== 'string'
    || typeof draft.receiptDate !== 'string'
    || typeof draft.receiptNumber !== 'string'
    || !source
    || (customerId !== null && typeof customerId !== 'string')
    || typeof draft.payer !== 'string'
    || (invoiceId !== null && typeof invoiceId !== 'string')
    || typeof draft.invoiceAllocated !== 'string'
    || !method
    || !receivedInto
    || (draft.currency !== 'USD' && draft.currency !== 'ZiG')
    || typeof draft.amount !== 'number'
    || typeof draft.reference !== 'string'
    || typeof draft.receivedBy !== 'string'
    || typeof draft.notes !== 'string'
    || typeof draft.createdAt !== 'string') return null
  return {
    id: draft.id,
    receiptDate: draft.receiptDate,
    receiptNumber: draft.receiptNumber,
    source,
    customerId,
    payer: draft.payer,
    invoiceId,
    invoiceAllocated: draft.invoiceAllocated,
    method,
    receivedInto,
    currency: draft.currency,
    amount: draft.amount,
    reference: draft.reference,
    receivedBy: draft.receivedBy,
    notes: draft.notes,
    createdAt: draft.createdAt,
  }
}

function getReceiptInvoice(receipt: ReceiptDraft, sales: SalesDraft[]) {
  if (receipt.invoiceId) return sales.find((sale) => sale.id === receipt.invoiceId)
  const invoiceReference = receipt.invoiceAllocated.trim().toLocaleLowerCase()
  return invoiceReference ? sales.find((sale) => sale.invoiceNumber.trim().toLocaleLowerCase() === invoiceReference) : undefined
}

function getInvoiceOutstanding(sale: SalesDraft, receipts: ReceiptDraft[]) {
  const allocated = receipts
    .filter((receipt) => getReceiptInvoice(receipt, [sale])?.id === sale.id && receipt.currency === sale.currency)
    .reduce((total, receipt) => total + receipt.amount, 0)
  return sale.amount - allocated
}

function isPaymentDraft(value: unknown): value is PaymentDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return typeof draft.id === 'string'
    && typeof draft.paidDate === 'string'
    && typeof draft.voucherNumber === 'string'
    && typeof draft.payee === 'string'
    && paymentSpendClasses.some((spendClass) => spendClass === draft.spendClass)
    && typeof draft.category === 'string'
    && typeof draft.purpose === 'string'
    && typeof draft.sourceReference === 'string'
    && typeof draft.paidFrom === 'string'
    && receiptMethods.some((method) => method === draft.method)
    && (draft.currency === 'USD' || draft.currency === 'ZiG')
    && typeof draft.amount === 'number'
    && typeof draft.approvedBy === 'string'
    && typeof draft.paidBy === 'string'
    && typeof draft.notes === 'string'
    && typeof draft.createdAt === 'string'
}

function isSupplierBillDraft(value: unknown): value is SupplierBillDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return typeof draft.id === 'string'
    && typeof draft.billDate === 'string'
    && typeof draft.supplierInvoiceNumber === 'string'
    && typeof draft.supplierName === 'string'
    && (draft.billType === 'Inventory' || draft.billType === 'Operating expense')
    && typeof draft.category === 'string'
    && typeof draft.description === 'string'
    && typeof draft.sourceReference === 'string'
    && (draft.currency === 'USD' || draft.currency === 'ZiG')
    && typeof draft.amount === 'number'
    && typeof draft.dueDate === 'string'
    && typeof draft.supplierCode === 'string'
    && typeof draft.enteredBy === 'string'
    && typeof draft.approvedBy === 'string'
    && typeof draft.notes === 'string'
    && typeof draft.createdAt === 'string'
}

function isCustomerAccountDraft(value: unknown): value is CustomerAccountDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return typeof draft.id === 'string'
    && typeof draft.customerCode === 'string'
    && typeof draft.name === 'string'
    && (draft.proposedCreditLimitUsd === null || typeof draft.proposedCreditLimitUsd === 'number')
    && typeof draft.termsDays === 'number'
    && typeof draft.approvedBy === 'string'
    && typeof draft.approvalDate === 'string'
    && typeof draft.followUp === 'string'
    && typeof draft.createdAt === 'string'
}

function isCashCloseDraft(value: unknown): value is CashCloseDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return typeof draft.id === 'string'
    && typeof draft.date === 'string'
    && typeof draft.openingUsd === 'number'
    && typeof draft.withdrawalsUsd === 'number'
    && typeof draft.depositsUsd === 'number'
    && (draft.actualUsd === null || typeof draft.actualUsd === 'number')
    && typeof draft.openingZiG === 'number'
    && typeof draft.withdrawalsZiG === 'number'
    && typeof draft.depositsZiG === 'number'
    && (draft.actualZiG === null || typeof draft.actualZiG === 'number')
    && typeof draft.preparedBy === 'string'
    && typeof draft.witness === 'string'
    && typeof draft.exceptionRef === 'string'
    && typeof draft.createdAt === 'string'
}

function isStockMovementDraft(value: unknown): value is StockMovementDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return typeof draft.id === 'string'
    && typeof draft.date === 'string'
    && typeof draft.itemCode === 'string'
    && typeof draft.description === 'string'
    && typeof draft.location === 'string'
    && stockMovementTypes.some((movementType) => movementType === draft.movementType)
    && typeof draft.sourceReference === 'string'
    && typeof draft.quantityIn === 'number'
    && typeof draft.quantityOut === 'number'
    && (draft.unitCostUsd === null || typeof draft.unitCostUsd === 'number')
    && typeof draft.enteredBy === 'string'
    && typeof draft.checkedBy === 'string'
    && typeof draft.notes === 'string'
    && typeof draft.createdAt === 'string'
}

function isExceptionUpdate(value: unknown): value is ExceptionUpdate {
  if (!value || typeof value !== 'object') return false
  const update = value as Record<string, unknown>
  return typeof update.id === 'string'
    && exceptionStatuses.some((status) => status === update.status)
    && typeof update.action === 'string'
    && typeof update.reviewer === 'string'
    && typeof update.closedDate === 'string'
    && typeof update.updatedAt === 'string'
}

function isExceptionDraft(value: unknown): value is ExceptionDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return typeof draft.id === 'string'
    && typeof draft.exceptionId === 'string'
    && typeof draft.raisedDate === 'string'
    && typeof draft.area === 'string'
    && typeof draft.sourceReference === 'string'
    && typeof draft.issue === 'string'
    && (draft.amount === null || typeof draft.amount === 'number')
    && (draft.currency === '' || draft.currency === 'USD' || draft.currency === 'ZiG')
    && typeof draft.owner === 'string'
    && typeof draft.dueDate === 'string'
    && Array.isArray(draft.updates)
    && draft.updates.every(isExceptionUpdate)
    && typeof draft.createdAt === 'string'
}

function SalesInvoicesView({
  drafts,
  localDrafts,
  customers,
  connected,
  loading,
  onSaveDraft,
}: {
  drafts: SalesDraft[]
  localDrafts: SalesDraft[]
  customers: CustomerAccountDraft[]
  connected: boolean
  loading: boolean
  onSaveDraft: (draft: SalesDraft) => void | Promise<void>
}) {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [saleDate, setSaleDate] = useState(getLocalDate())
  const [customerId, setCustomerId] = useState('')
  const [customer, setCustomer] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [saleType, setSaleType] = useState<SaleType>('Cash')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!invoiceNumber.trim() || !customer.trim() || !description.trim()) {
      setError('Enter an invoice reference, customer name, and item or service.')
      return
    }
    if ([...drafts, ...localDrafts].some((draft) => draft.invoiceNumber.trim().toLocaleLowerCase() === invoiceNumber.trim().toLocaleLowerCase())) {
      setError('That invoice reference is already recorded. Check the original invoice and existing entries.')
      return
    }
    if (saleType !== 'Cash' && !customerId) {
      setError('Select a customer account for credit or part-paid sales.')
      return
    }
    if (saleType !== 'Cash' && !dueDate) {
      setError('Enter the invoice due date for a credit or part-paid sale.')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }

    try {
      setSaving(true)
      await onSaveDraft({
        id: crypto.randomUUID(),
        invoiceNumber: invoiceNumber.trim(),
        saleDate,
        customerId: customerId || null,
        customer: customer.trim(),
        description: description.trim(),
        amount: parsedAmount,
        currency,
        saleType,
        dueDate: saleType === 'Cash' ? '' : dueDate,
        createdAt: new Date().toISOString(),
      })
      setInvoiceNumber('')
      setSaleDate(getLocalDate())
      setCustomerId('')
      setCustomer('')
      setDescription('')
      setAmount('')
      setSaleType('Cash')
      setDueDate('')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The sale was not saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="content">
      <section className="welcome module-welcome">
        <div><span className="eyebrow">OPERATIONS MODULE</span><h2>Sales &amp; invoices</h2></div>
      </section>
      <div className="sales-layout">
        <article className="panel sales-form-panel">
          <div className="panel-head"><div><span>{connected ? 'SERVER VALIDATED' : 'LOCAL CAPTURE'}</span><h3>{connected ? 'Record sale' : 'New sales draft'}</h3></div></div>
          <form className="sales-form" onSubmit={submitDraft}>
            <label>
              Invoice reference (enter number already on paper)
              <input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} required maxLength={40} />
            </label>
            <label>
              Sale date
              <input type="date" value={saleDate} onChange={(event) => setSaleDate(event.target.value)} required />
            </label>
            <label>
              Customer account (required for credit)
              <select value={customerId} onChange={(event) => {
                const selected = customers.find((item) => item.id === event.target.value)
                setCustomerId(selected?.id ?? '')
                setCustomer(selected?.name ?? '')
              }}>
                <option value="">Unregistered / walk-in</option>
                {customers.map((item) => <option key={item.id} value={item.id}>{item.customerCode} · {item.name}</option>)}
              </select>
            </label>
            {!customerId && <label>Customer / payer name<input value={customer} onChange={(event) => setCustomer(event.target.value)} required maxLength={120} /></label>}
            <label>
              Item or service
              <input value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={160} />
            </label>
            <div className="amount-fields">
              <label>
                Amount
                <input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min="0.01" step="0.01" required />
              </label>
              <label>
                Currency
                <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
                  <option value="USD">USD</option>
                  <option value="ZiG">ZiG</option>
                </select>
              </label>
            </div>
            <div className="receipt-fields">
              <label>
                Sale type
                <select value={saleType} onChange={(event) => setSaleType(event.target.value as SaleType)}>
                  {saleTypes.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              {saleType !== 'Cash' && <label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label>}
            </div>
            <p className="form-note">Enter the reference already used on the original invoice; this app does not issue or generate numbers. Credit and part-paid sales must use a saved customer account. Older drafts without invoice data remain unclassified and are not included in customer balances.</p>
            {saleType !== 'Cash' && <p className="form-note">{connected ? 'The server checks MD credit approval, account limit, and approved exchange rate before accepting this sale.' : 'Confirm Managing Director approval and account terms against source records before extending credit. Local drafts do not verify approval or enforce limits.'}</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : connected ? 'Save to server' : 'Save local draft'}</button>
          </form>
        </article>
        <article className="panel drafts-panel">
          <div className="panel-head"><div><span>{connected ? 'AUTHORITATIVE API RECORDS' : 'AWAITING SERVER VALIDATION'}</span><h3>{connected ? 'Server sales' : 'Local drafts'} <small>{drafts.length}</small></h3></div></div>
          {drafts.length === 0 ? (
            <p className="empty-drafts">No local sales drafts yet.</p>
          ) : (
            <div className="draft-list">
              {drafts.slice().reverse().map((draft) => (
                <div className="draft-row" key={draft.id}>
                  <div><strong>{draft.invoiceNumber || 'Legacy sale'} · {draft.customer}</strong><small>{draft.saleDate} · {draft.saleType}{draft.dueDate ? ` · Due ${draft.dueDate}` : ''} · {draft.description}</small></div>
                  <span>{draft.currency} {draft.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="form-note draft-warning">{connected ? 'Sales are validated and recorded by the authenticated API. Paper invoice issuance and number generation remain manual.' : 'Saved only in this browser. Local drafts are not uploaded automatically.'}</p>
        </article>
      </div>
      {connected && localDrafts.length > 0 && (
        <LocalDraftNotice label="Sales" count={localDrafts.length}>
          {localDrafts.map((draft) => `${draft.invoiceNumber || 'Legacy sale'} · ${draft.customer}`)}
        </LocalDraftNotice>
      )}
    </div>
  )
}

function ReceiptsView({
  drafts,
  localDrafts,
  sales,
  customers,
  connected,
  loading,
  onSaveDraft,
}: {
  drafts: ReceiptDraft[]
  localDrafts: ReceiptDraft[]
  sales: SalesDraft[]
  customers: CustomerAccountDraft[]
  connected: boolean
  loading: boolean
  onSaveDraft: (draft: ReceiptDraft) => void | Promise<void>
}) {
  const [receiptDate, setReceiptDate] = useState(getLocalDate())
  const [receiptNumber, setReceiptNumber] = useState('')
  const [source, setSource] = useState<ReceiptSource>('Same-day sale payment')
  const [payer, setPayer] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [method, setMethod] = useState<ReceiptMethod>('Cash')
  const [receivedInto, setReceivedInto] = useState<ReceiptDestination>('Till USD')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const selectedInvoice = sales.find((sale) => sale.id === invoiceId)
  const selectedCustomer = customers.find((customer) => customer.id === customerId)
  const supportsAllocation = source === 'Debtor collection' || source === 'Same-day sale payment' || source === 'Customer deposit'
  const openInvoices = sales.filter((sale) =>
    sale.saleType !== 'Unclassified' && sale.invoiceNumber && getInvoiceOutstanding(sale, drafts) > 0 && (!customerId || sale.customerId === customerId),
  )

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (invoiceId && !selectedInvoice) {
      setError('The selected invoice could not be found.')
      return
    }
    if (selectedInvoice && !supportsAllocation) {
      setError('This receipt source cannot be allocated to an invoice.')
      return
    }
    const payerName = selectedInvoice?.customer ?? selectedCustomer?.name ?? payer.trim()
    if (!receiptNumber.trim() || !payerName || !receivedBy.trim()) {
      setError('Enter the pre-numbered receipt reference, payer, and person receiving the funds.')
      return
    }
    if (selectedInvoice && selectedInvoice.currency !== currency) {
      setError('Receipt currency must match the selected invoice currency.')
      return
    }
    if (selectedInvoice && parsedAmount > getInvoiceOutstanding(selectedInvoice, drafts)) {
      setError('Receipt amount cannot exceed the selected invoice’s remaining balance.')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }

    try {
      setSaving(true)
      await onSaveDraft({
        id: crypto.randomUUID(),
        receiptDate,
        receiptNumber: receiptNumber.trim(),
        source,
        customerId: selectedInvoice?.customerId ?? (customerId || null),
        payer: selectedInvoice?.customer ?? selectedCustomer?.name ?? payer.trim(),
        invoiceId: selectedInvoice?.id ?? null,
        invoiceAllocated: selectedInvoice?.invoiceNumber ?? '',
        method,
        receivedInto,
        currency,
        amount: parsedAmount,
        reference: reference.trim(),
        receivedBy: receivedBy.trim(),
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      })
      setReceiptNumber('')
      setPayer('')
      setInvoiceId('')
      setAmount('')
      setReference('')
      setReceivedBy('')
      setNotes('')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The receipt was not saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="content">
      <section className="welcome module-welcome">
        <div><span className="eyebrow">OPERATIONS MODULE</span><h2>Receipts</h2></div>
      </section>
      <div className="receipt-layout">
        <article className="panel receipt-form-panel">
          <div className="panel-head"><div><span>{connected ? 'SERVER VALIDATED' : 'LOCAL CAPTURE'}</span><h3>{connected ? 'Record receipt' : 'New receipt draft'}</h3></div></div>
          <form className="receipt-form" onSubmit={submitDraft}>
            <div className="receipt-fields">
              <label>Receipt date<input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} required /></label>
              <label>
                Pre-numbered receipt no.
                <input value={receiptNumber} onChange={(event) => setReceiptNumber(event.target.value)} required maxLength={40} />
              </label>
            </div>
            <label>
              Source type
              <select value={source} onChange={(event) => {
                const nextSource = event.target.value as ReceiptSource
                setSource(nextSource)
                if (nextSource !== 'Debtor collection' && nextSource !== 'Same-day sale payment' && nextSource !== 'Customer deposit') {
                  setInvoiceId('')
                  setCustomerId('')
                }
              }}>
                {receiptSources.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            {supportsAllocation && (
              <>
                <label>Customer account (optional)
                  <select value={customerId} onChange={(event) => {
                    const selected = customers.find((item) => item.id === event.target.value)
                    setCustomerId(selected?.id ?? '')
                    setPayer(selected?.name ?? '')
                    if (selectedInvoice && selectedInvoice.customerId !== selected?.id) setInvoiceId('')
                  }}>
                    <option value="">Unregistered / not selected</option>
                    {customers.map((item) => <option key={item.id} value={item.id}>{item.customerCode} · {item.name}</option>)}
                  </select>
                </label>
                <label>Invoice allocation (optional)
                  <select value={invoiceId} onChange={(event) => {
                    const selected = sales.find((sale) => sale.id === event.target.value)
                    setInvoiceId(selected?.id ?? '')
                    setCustomerId(selected?.customerId ?? '')
                    setPayer(selected?.customer ?? '')
                    if (selected) setCurrency(selected.currency)
                  }}>
                    <option value="">Unallocated / no invoice</option>
                    {openInvoices.map((sale) => (
                      <option key={sale.id} value={sale.id}>
                        {sale.invoiceNumber} · {sale.customer} · balance {sale.currency} {getInvoiceOutstanding(sale, drafts).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="form-note">Link a debtor receipt or customer deposit to an account; select an invoice to allocate it. Unallocated receipts remain separate and do not reduce balances.</p>
              </>
            )}
            <label>Payer / customer<input value={selectedInvoice?.customer ?? selectedCustomer?.name ?? payer} onChange={(event) => setPayer(event.target.value)} required maxLength={120} readOnly={Boolean(selectedInvoice || selectedCustomer)} /></label>
            {selectedInvoice && <p className="form-note">Payer and currency follow the invoice. The receipt cannot exceed its remaining balance.</p>}
            <div className="receipt-fields">
              <label>
                Method
                <select value={method} onChange={(event) => setMethod(event.target.value as ReceiptMethod)}>
                  {receiptMethods.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                Received into
                <select value={receivedInto} onChange={(event) => setReceivedInto(event.target.value as ReceiptDestination)}>
                  {receiptDestinations.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="amount-fields">
              <label>Amount<input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min="0.01" step="0.01" required /></label>
              <label>
                Currency
                <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
                  <option value="USD">USD</option>
                  <option value="ZiG">ZiG</option>
                </select>
              </label>
            </div>
            <label>Bank / POS reference (optional)<input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={80} /></label>
            <label>Received by<input value={receivedBy} onChange={(event) => setReceivedBy(event.target.value)} required maxLength={80} /></label>
            <label>Notes (optional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={240} rows={2} /></label>
            <p className="form-note">Use the number already issued from the pre-numbered SD-03 receipt book. This app does not issue numbers.{connected ? ' The server checks invoice balance, currency, and approved exchange rate.' : ' Local drafts do not validate exchange rates or server balances.'}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : connected ? 'Save to server' : 'Save local receipt draft'}</button>
          </form>
        </article>
        <article className="panel receipt-list-panel">
          <div className="panel-head"><div><span>{connected ? 'AUTHORITATIVE API RECORDS' : 'AWAITING SERVER VALIDATION'}</span><h3>{connected ? 'Server receipts' : 'Receipt drafts'} <small>{drafts.length}</small></h3></div></div>
          {drafts.length === 0 ? (
            <p className="empty-drafts">No receipt drafts yet.</p>
          ) : (
            <div className="receipt-list">
              {drafts.slice().reverse().map((draft) => {
                const duplicate = drafts.filter((item) => item.receiptNumber.trim().toLowerCase() === draft.receiptNumber.trim().toLowerCase()).length > 1
                const allocation = getAllocationStatus(draft, sales)
                const ageStatus = getUnallocatedAgeStatus(draft, sales)
                return (
                  <div className="receipt-row" key={draft.id}>
                    <div className="receipt-row-main">
                      <strong>{draft.receiptNumber} · {draft.payer}</strong>
                      <small>{draft.receiptDate} · {draft.source} · {draft.method} to {draft.receivedInto}</small>
                      <div className="receipt-statuses">
                        {duplicate && <span className="receipt-warning">Duplicate receipt no. — check SD-03</span>}
                        <span className={allocation.startsWith('UNALLOCATED') || allocation.startsWith('UNAPPLIED') || allocation.startsWith('UNVERIFIED') ? 'receipt-warning' : allocation.startsWith('Allocated') ? 'receipt-ok' : 'receipt-pending'}>{allocation}</span>
                        {ageStatus && <span className={ageStatus.escalated ? 'receipt-warning' : 'receipt-ok'}>{ageStatus.label}</span>}
                        {!connected && <span className="receipt-pending">Local-only draft</span>}
                      </div>
                    </div>
                    <span className="receipt-amount">{draft.currency} {draft.amount.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          )}
          <p className="form-note receipt-warning-note">{connected ? 'The server validates invoice allocations and records receipt audit events. The physical receipt book remains the source for receipt numbers.' : 'Local-only drafts are not uploaded automatically. Receipt sequence, rate and invoice checks are local estimates.'}</p>
        </article>
      </div>
      {connected && localDrafts.length > 0 && (
        <LocalDraftNotice label="Receipts" count={localDrafts.length}>
          {localDrafts.map((draft) => `${draft.receiptNumber} · ${draft.payer}`)}
        </LocalDraftNotice>
      )}
    </div>
  )
}

function PaymentsView({
  drafts,
  localDrafts,
  supplierBills,
  connected,
  loading,
  role,
  username,
  onSaveDraft,
  onReview,
}: {
  drafts: PaymentDraft[]
  localDrafts: PaymentDraft[]
  supplierBills: SupplierBillDraft[]
  connected: boolean
  loading: boolean
  role: ApiUser['role']
  username: string
  onSaveDraft: (draft: PaymentDraft) => void | Promise<void>
  onReview: (paymentId: string, decision: 'approved' | 'rejected') => Promise<void>
}) {
  const [paidDate, setPaidDate] = useState(getLocalDate())
  const [voucherNumber, setVoucherNumber] = useState('')
  const [payee, setPayee] = useState('')
  const [spendClass, setSpendClass] = useState<PaymentSpendClass>('Inventory purchase')
  const [supplierBillId, setSupplierBillId] = useState('')
  const [category, setCategory] = useState('')
  const [purpose, setPurpose] = useState('')
  const [sourceReference, setSourceReference] = useState('')
  const [paidFrom, setPaidFrom] = useState('')
  const [method, setMethod] = useState<ReceiptMethod>('Bank transfer')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [amount, setAmount] = useState('')
  const [approvedBy, setApprovedBy] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const selectedBill = supplierBills.find((bill) => bill.id === supplierBillId)
  const remainingForBill = (bill: SupplierBillDraft) => bill.amount - drafts
    .filter((payment) => payment.supplierBillId === bill.id && payment.reviewStatus !== 'rejected')
    .reduce((total, payment) => total + payment.amount, 0)

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if ([...drafts, ...localDrafts].some((draft) => draft.voucherNumber.trim().toLocaleLowerCase() === voucherNumber.trim().toLocaleLowerCase())) {
      setError('That voucher reference is already recorded.')
      return
    }
    if (connected && spendClass === 'Supplier settlement' && !selectedBill) {
      setError('Select an MD-approved server supplier bill to settle.')
      return
    }
    if (selectedBill && parsedAmount > remainingForBill(selectedBill)) {
      setError(`Amount exceeds the bill's remaining balance of ${selectedBill.currency} ${remainingForBill(selectedBill).toFixed(2)}.`)
      return
    }

    try {
      setSaving(true)
      await onSaveDraft({
        id: crypto.randomUUID(),
        paidDate,
        voucherNumber: voucherNumber.trim(),
        payee: payee.trim(),
        spendClass,
        category: category.trim(),
        purpose: purpose.trim(),
        sourceReference: sourceReference.trim(),
        paidFrom: paidFrom.trim(),
        method,
        currency,
        amount: parsedAmount,
        approvedBy: approvedBy.trim(),
        paidBy: paidBy.trim(),
        notes: notes.trim(),
        supplierBillId: supplierBillId || null,
        supplierInvoiceNumber: selectedBill?.supplierInvoiceNumber ?? null,
        createdAt: new Date().toISOString(),
      })
      setVoucherNumber('')
      setPayee('')
      setCategory('')
      setPurpose('')
      setSourceReference('')
      setPaidFrom('')
      setAmount('')
      setApprovedBy('')
      setPaidBy('')
      setNotes('')
      setSupplierBillId('')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The payment voucher was not saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="content">
      <section className="welcome module-welcome">
        <div><span className="eyebrow">OPERATIONS MODULE</span><h2>Payments</h2></div>
      </section>
      <div className="payment-layout">
        <article className="panel payment-form-panel">
          <div className="panel-head"><div><span>{connected ? 'SERVER VALIDATED' : 'LOCAL CAPTURE'}</span><h3>New payment voucher record</h3></div></div>
          <form className="payment-form" onSubmit={submitDraft}>
            <div className="receipt-fields">
              <label>Paid date<input type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} required /></label>
              <label>
                Pre-numbered voucher no.
                <input value={voucherNumber} onChange={(event) => setVoucherNumber(event.target.value)} required maxLength={40} />
              </label>
            </div>
            <label>Payee / supplier<input value={payee} onChange={(event) => setPayee(event.target.value)} required maxLength={120} /></label>
            <label>
              Spend class
            <select value={spendClass} onChange={(event) => {
              const nextSpendClass = event.target.value as PaymentSpendClass
              setSpendClass(nextSpendClass)
              if (nextSpendClass !== 'Supplier settlement') setSupplierBillId('')
            }}>
                {paymentSpendClasses.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            {spendClass === 'Supplier settlement' && (
            connected ? (
              <label>Approved supplier bill
                <select value={supplierBillId} onChange={(event) => {
                  const bill = supplierBills.find((item) => item.id === event.target.value)
                  setSupplierBillId(bill?.id ?? '')
                  setPayee(bill?.supplierName ?? '')
                  setSourceReference(bill?.supplierInvoiceNumber ?? '')
                  if (bill) setCurrency(bill.currency)
                }}>
                  <option value="">Select an approved open bill</option>
                  {supplierBills.filter((bill) => bill.reviewStatus === 'approved' && remainingForBill(bill) > 0).map((bill) => (
                    <option key={bill.id} value={bill.id}>
                      {bill.supplierInvoiceNumber} · {bill.supplierName} · remaining {bill.currency} {remainingForBill(bill).toFixed(2)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="form-note payment-warning">Use this for payment against a supplier bill already recorded in Supplier Bills. Do not record the purchase as a second expense.</p>
            )
            )}
            <label>Category (optional)<input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} /></label>
            <label>Purpose / description<input value={purpose} onChange={(event) => setPurpose(event.target.value)} required maxLength={160} /></label>
            <label>PO / GRN / invoice reference<input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} required maxLength={100} readOnly={Boolean(selectedBill)} /></label>
            <label>Paid from<input value={paidFrom} onChange={(event) => setPaidFrom(event.target.value)} required maxLength={80} /></label>
            <div className="receipt-fields">
              <label>
                Method
                <select value={method} onChange={(event) => setMethod(event.target.value as ReceiptMethod)}>
                  {receiptMethods.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <div className="amount-fields">
                <label>Amount<input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min="0.01" step="0.01" required /></label>
                <label>
                  Currency
                  <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)} disabled={Boolean(selectedBill)}>
                    <option value="USD">USD</option>
                    <option value="ZiG">ZiG</option>
                  </select>
                </label>
              </div>
            </div>
            {!connected && <div className="receipt-fields">
              <label>Approval name / reference<input value={approvedBy} onChange={(event) => setApprovedBy(event.target.value)} required maxLength={100} /></label>
              <label>Paid by<input value={paidBy} onChange={(event) => setPaidBy(event.target.value)} required maxLength={80} /></label>
            </div>}
            {connected && <label>Recorded by<input value={paidBy} onChange={(event) => setPaidBy(event.target.value)} required maxLength={80} /></label>}
            <label>Notes (optional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={240} rows={2} /></label>
            <p className="form-note">Record the SD-04 voucher number already issued. {connected ? 'The API records a voucher for separate MD review; it does not authorize or disburse funds. ZiG values use the approved rate snapshot.' : 'This local draft does not authorize or disburse payments, verify approval, attach original documents, or calculate USD equivalents.'} Retain the voucher and required supplier, delivery, approval, and payment evidence.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : connected ? 'Save to server' : 'Save local payment draft'}</button>
          </form>
        </article>
        <article className="panel payment-list-panel">
          <div className="panel-head"><div><span>{connected ? 'AUTHORITATIVE API RECORDS' : 'AWAITING SERVER VALIDATION'}</span><h3>{connected ? 'Server vouchers' : 'Payment drafts'} <small>{drafts.length}</small></h3></div></div>
          {drafts.length === 0 ? (
            <p className="empty-drafts">No payment drafts yet.</p>
          ) : (
            <div className="payment-list">
              {drafts.slice().reverse().map((draft) => {
                const duplicate = drafts.filter((item) => item.voucherNumber.trim().toLowerCase() === draft.voucherNumber.trim().toLowerCase()).length > 1
                return (
                  <div className="payment-row" key={draft.id}>
                    <div className="payment-row-main">
                      <strong>{draft.voucherNumber} · {draft.payee}</strong>
                      <small>{draft.paidDate} · {draft.spendClass}{draft.category ? ` · ${draft.category}` : ''}</small>
                      <small>{draft.purpose} · Ref: {draft.sourceReference}</small>
                      <div className="receipt-statuses">
                        {duplicate && <span className="receipt-warning">Duplicate voucher no. — check SD-04</span>}
                        <span className={connected ? draft.reviewStatus === 'approved' ? 'receipt-ok' : draft.reviewStatus === 'rejected' ? 'receipt-warning' : 'receipt-pending' : 'receipt-pending'}>
                          {connected ? `MD review: ${draft.reviewStatus ?? 'pending'}` : 'Local-only draft'}
                        </span>
                      </div>
                      {connected && draft.createdBy === username && <small>Created by you</small>}
                      {connected && role === 'managing_director' && draft.reviewStatus === 'pending' && draft.createdBy !== username && (
                        <ReviewActions onDecision={(decision) => onReview(draft.id, decision)} />
                      )}
                    </div>
                    <span className="receipt-amount">{draft.currency} {draft.amount.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          )}
          <p className="form-note receipt-warning-note">{connected ? 'Only a different Managing Director may review a voucher. Approval records are not a funds-transfer instruction.' : 'Saved only in this browser. Voucher sequence, approval authority, supporting documents, and approved exchange-rate checks are not connected.'}</p>
        </article>
      </div>
      {connected && localDrafts.length > 0 && (
        <LocalDraftNotice label="Payments" count={localDrafts.length}>
          {localDrafts.map((draft) => `${draft.voucherNumber} · ${draft.payee}`)}
        </LocalDraftNotice>
      )}
    </div>
  )
}

function getLocalDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getAllocationStatus(draft: ReceiptDraft, sales: SalesDraft[]) {
  const invoice = getReceiptInvoice(draft, sales)
  if (invoice && invoice.currency !== draft.currency) return `UNVERIFIED currency mismatch for ${invoice.invoiceNumber}`
  if (invoice) return `Allocated to ${invoice.invoiceNumber}`
  if (draft.invoiceAllocated) return `UNVERIFIED allocation reference: ${draft.invoiceAllocated}`
  if (draft.source === 'Debtor collection') return 'UNALLOCATED DEBTOR RECEIPT'
  if (draft.source === 'Same-day sale payment') return 'UNALLOCATED SAME-DAY SALE PAYMENT'
  if (draft.source === 'Customer deposit') return 'UNAPPLIED CUSTOMER DEPOSIT'
  return 'No invoice allocation required'
}

function getUnallocatedAgeStatus(draft: ReceiptDraft, sales: SalesDraft[]) {
  if (getReceiptInvoice(draft, sales) || draft.invoiceAllocated || (draft.source !== 'Debtor collection' && draft.source !== 'Customer deposit')) return null
  const received = new Date(`${draft.receiptDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.max(0, Math.floor((today.getTime() - received.getTime()) / 86_400_000))
  return { label: days > 7 ? `OVER 7 DAYS - ESCALATE (${days} days)` : `WITHIN 7 DAYS (${days} days)`, escalated: days > 7 }
}

function SupplierBillsView({
  drafts,
  localDrafts,
  connected,
  loading,
  role,
  username,
  onSaveDraft,
  onReview,
}: {
  drafts: SupplierBillDraft[]
  localDrafts: SupplierBillDraft[]
  connected: boolean
  loading: boolean
  role: ApiUser['role']
  username: string
  onSaveDraft: (draft: SupplierBillDraft) => void | Promise<void>
  onReview: (billId: string, decision: 'approved' | 'rejected') => Promise<void>
}) {
  const [billDate, setBillDate] = useState(getLocalDate())
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [billType, setBillType] = useState<SupplierBillDraft['billType']>('Inventory')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [sourceReference, setSourceReference] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [supplierCode, setSupplierCode] = useState('')
  const [enteredBy, setEnteredBy] = useState('')
  const [approvedBy, setApprovedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if ([...drafts, ...localDrafts].some((draft) =>
      draft.supplierName.trim().toLocaleLowerCase() === supplierName.trim().toLocaleLowerCase()
      && draft.supplierInvoiceNumber.trim().toLocaleLowerCase() === supplierInvoiceNumber.trim().toLocaleLowerCase(),
    )) {
      setError('That supplier invoice is already recorded for this supplier.')
      return
    }

    try {
      setSaving(true)
      await onSaveDraft({
        id: crypto.randomUUID(),
        billDate,
        supplierInvoiceNumber: supplierInvoiceNumber.trim(),
        supplierName: supplierName.trim(),
        billType,
        category: category.trim(),
        description: description.trim(),
        sourceReference: sourceReference.trim(),
        currency,
        amount: parsedAmount,
        dueDate,
        supplierCode: supplierCode.trim(),
        enteredBy: enteredBy.trim(),
        approvedBy: approvedBy.trim(),
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      })
      setSupplierInvoiceNumber('')
      setSupplierName('')
      setCategory('')
      setDescription('')
      setSourceReference('')
      setAmount('')
      setDueDate('')
      setSupplierCode('')
      setEnteredBy('')
      setApprovedBy('')
      setNotes('')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The supplier bill was not saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="content">
      <section className="welcome module-welcome">
        <div><span className="eyebrow">OPERATIONS MODULE</span><h2>Supplier Bills</h2></div>
      </section>
      <div className="bill-layout">
        <article className="panel bill-form-panel">
          <div className="panel-head"><div><span>{connected ? 'SERVER VALIDATED' : 'LOCAL CAPTURE'}</span><h3>New supplier bill record</h3></div></div>
          <form className="bill-form" onSubmit={submitDraft}>
            <div className="receipt-fields">
              <label>Bill date<input type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} required /></label>
              <label>Supplier invoice no.<input value={supplierInvoiceNumber} onChange={(event) => setSupplierInvoiceNumber(event.target.value)} required maxLength={60} /></label>
            </div>
            <label>Supplier name<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} required maxLength={120} /></label>
            <div className="receipt-fields">
              <label>
                Bill type
                <select value={billType} onChange={(event) => setBillType(event.target.value as SupplierBillDraft['billType'])}>
                  <option value="Inventory">Inventory</option>
                  <option value="Operating expense">Operating expense</option>
                </select>
              </label>
              <label>Expense category (optional)<input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} /></label>
            </div>
            <label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={160} /></label>
            <label>PO / GRN / delivery reference<input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} required maxLength={100} /></label>
            <div className="amount-fields">
              <label>Amount<input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min="0.01" step="0.01" required /></label>
              <label>
                Currency
                <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
                  <option value="USD">USD</option>
                  <option value="ZiG">ZiG</option>
                </select>
              </label>
            </div>
            <div className="receipt-fields">
              <label>Due date (optional)<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
              <label>Supplier code (optional)<input value={supplierCode} onChange={(event) => setSupplierCode(event.target.value)} maxLength={40} /></label>
            </div>
            {!connected && <div className="receipt-fields">
              <label>Entered by<input value={enteredBy} onChange={(event) => setEnteredBy(event.target.value)} required maxLength={80} /></label>
              <label>
                Approved by (leave blank pending MD review)
                <input value={approvedBy} onChange={(event) => setApprovedBy(event.target.value)} maxLength={100} />
              </label>
            </div>}
            {connected && <label>Entered by<input value={enteredBy} onChange={(event) => setEnteredBy(event.target.value)} required maxLength={80} /></label>}
            <label>Notes (optional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={240} rows={2} /></label>
            <p className="form-note">Capture the supplier invoice when goods or services are received, even if unpaid. When paid, record the payment separately as Supplier settlement—not as a second purchase or expense. Retain the original invoice, PO, and delivery evidence.</p>
            <p className="form-note">{connected ? 'The server snapshots the approved exchange rate and records a pending MD review. It does not post an accounting entry.' : 'This local draft does not validate exchange rates, approval checks, attachments, or accounting posting.'}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : connected ? 'Save to server' : 'Save local bill draft'}</button>
          </form>
        </article>
        <article className="panel bill-list-panel">
          <div className="panel-head"><div><span>{connected ? 'AUTHORITATIVE API RECORDS' : 'AWAITING SERVER VALIDATION'}</span><h3>{connected ? 'Server supplier bills' : 'Supplier bill drafts'} <small>{drafts.length}</small></h3></div></div>
          {drafts.length === 0 ? (
            <p className="empty-drafts">No supplier bill drafts yet.</p>
          ) : (
            <div className="bill-list">
              {drafts.slice().reverse().map((draft) => (
                <div className="bill-row" key={draft.id}>
                  <div className="bill-row-main">
                    <strong>{draft.supplierInvoiceNumber} · {draft.supplierName}</strong>
                    <small>{draft.billDate} · {draft.billType}{draft.category ? ` · ${draft.category}` : ''}</small>
                    <small>{draft.description} · Ref: {draft.sourceReference}</small>
                    {draft.dueDate && <small>Due {draft.dueDate}</small>}
                    <div className="receipt-statuses">
                      {connected
                        ? <span className={draft.reviewStatus === 'approved' ? 'receipt-ok' : draft.reviewStatus === 'rejected' ? 'receipt-warning' : 'receipt-pending'}>MD review: {draft.reviewStatus ?? 'pending'}</span>
                        : <span className={draft.approvedBy ? 'receipt-pending' : 'receipt-warning'}>{draft.approvedBy ? `Approval recorded: ${draft.approvedBy} (not verified)` : 'Awaiting MD review'}</span>}
                    </div>
                    {connected && draft.createdBy === username && <small>Created by you</small>}
                    {connected && role === 'managing_director' && draft.reviewStatus === 'pending' && draft.createdBy !== username && (
                      <ReviewActions onDecision={(decision) => onReview(draft.id, decision)} />
                    )}
                  </div>
                  <span className="receipt-amount">{draft.currency} {draft.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="form-note receipt-warning-note">{connected ? 'Only a different Managing Director may review a bill. Supplier settlement vouchers may link to approved open bills; no funds are transferred here.' : 'Saved only in this browser. Bills are not linked to Payments; record settlements using the supplier invoice reference.'}</p>
        </article>
      </div>
      {connected && localDrafts.length > 0 && (
        <LocalDraftNotice label="Supplier Bills" count={localDrafts.length}>
          {localDrafts.map((draft) => `${draft.supplierInvoiceNumber} · ${draft.supplierName}`)}
        </LocalDraftNotice>
      )}
    </div>
  )
}

function CustomersView({
  drafts,
  localDrafts,
  sales,
  receipts,
  connected,
  loading,
  role,
  onSaveDraft,
  onCreditDecision,
}: {
  drafts: CustomerAccountDraft[]
  localDrafts: CustomerAccountDraft[]
  sales: SalesDraft[]
  receipts: ReceiptDraft[]
  connected: boolean
  loading: boolean
  role: ApiUser['role']
  onSaveDraft: (draft: CustomerAccountDraft) => void | Promise<void>
  onCreditDecision: (customerId: string, decision: 'approved' | 'rejected', limit: string) => Promise<void>
}) {
  const [customerCode, setCustomerCode] = useState('')
  const [name, setName] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [termsDays, setTermsDays] = useState('0')
  const [approvedBy, setApprovedBy] = useState('')
  const [approvalDate, setApprovalDate] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!customerCode.trim() || !name.trim()) {
      setError('Enter a customer code and account name.')
      return
    }
    if ([...drafts, ...localDrafts].some((draft) => draft.customerCode.trim().toLocaleLowerCase() === customerCode.trim().toLocaleLowerCase())) {
      setError('That customer code is already recorded.')
      return
    }
    const parsedTerms = Number(termsDays)
    const parsedCreditLimit = creditLimit === '' ? null : Number(creditLimit)
    if (!Number.isInteger(parsedTerms) || parsedTerms < 0 || parsedTerms > 365) {
      setError('Credit terms must be between 0 and 365 days.')
      return
    }
    if (parsedCreditLimit !== null && (!Number.isFinite(parsedCreditLimit) || parsedCreditLimit < 0)) {
      setError('Credit limit must be zero or greater.')
      return
    }
    if (!connected && ((approvedBy.trim() && !approvalDate) || (!approvedBy.trim() && approvalDate))) {
      setError('Enter both the approver and approval date, or leave both blank while approval is pending.')
      return
    }

    try {
      setSaving(true)
      await onSaveDraft({
        id: crypto.randomUUID(),
        customerCode: customerCode.trim(),
        name: name.trim(),
        proposedCreditLimitUsd: parsedCreditLimit,
        termsDays: parsedTerms,
        approvedBy: approvedBy.trim(),
        approvalDate,
        followUp: followUp.trim(),
        createdAt: new Date().toISOString(),
      })
      setCustomerCode('')
      setName('')
      setCreditLimit('')
      setTermsDays('0')
      setApprovedBy('')
      setApprovalDate('')
      setFollowUp('')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The customer was not saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="content">
      <section className="welcome module-welcome">
        <div><span className="eyebrow">OPERATIONS MODULE</span><h2>Customers</h2></div>
      </section>
      <div className="workflow-layout">
        <article className="panel">
          <div className="panel-head"><div><span>{connected ? 'SERVER VALIDATED' : 'LOCAL CAPTURE'}</span><h3>New customer account</h3></div></div>
          <form className="workflow-form" onSubmit={submitDraft}>
            <label>Customer code<input value={customerCode} onChange={(event) => setCustomerCode(event.target.value)} required maxLength={40} /></label>
            <label>Customer / account name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></label>
            <div className="receipt-fields">
              <label>Proposed credit limit (USD)<input type="number" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} min="0" step="0.01" /></label>
              <label>Credit terms (days)<input type="number" value={termsDays} onChange={(event) => setTermsDays(event.target.value)} min="0" max="365" step="1" required /></label>
            </div>
            {!connected && <div className="receipt-fields">
              <label>MD approver (optional)<input value={approvedBy} onChange={(event) => setApprovedBy(event.target.value)} maxLength={100} /></label>
              <label>Approval date<input type="date" value={approvalDate} onChange={(event) => setApprovalDate(event.target.value)} /></label>
            </div>}
            <label>Follow-up / notes (optional)<textarea value={followUp} onChange={(event) => setFollowUp(event.target.value)} maxLength={240} rows={2} /></label>
            <p className="form-note">{connected ? 'New accounts are pending until an authenticated Managing Director records a credit decision. The server enforces the approved limit.' : 'Credit extension requires Managing Director approval. This local draft does not verify approval or enforce a credit limit.'}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : connected ? 'Save to server' : 'Save local customer draft'}</button>
          </form>
        </article>
        <article className="panel">
          <div className="panel-head"><div><span>{connected ? 'AUTHORITATIVE API RECORDS' : 'LOCAL DRAFTS'}</span><h3>Customer accounts <small>{drafts.length}</small></h3></div></div>
          {drafts.length === 0 ? <p className="empty-drafts">No customer accounts yet.</p> : (
            <div className="workflow-list">
              {drafts.slice().reverse().map((draft) => {
                const customerSales = sales.filter((sale) => sale.customerId === draft.id && (sale.saleType === 'Credit' || sale.saleType === 'Part-paid'))
                const balanceUsd = customerSales.filter((sale) => sale.currency === 'USD').reduce((total, sale) => total + getInvoiceOutstanding(sale, receipts), 0)
                const balanceZiG = customerSales.filter((sale) => sale.currency === 'ZiG').reduce((total, sale) => total + getInvoiceOutstanding(sale, receipts), 0)
                const today = new Date(`${getLocalDate()}T00:00:00`).getTime()
                const overdueUsd = customerSales.filter((sale) => {
                  if (sale.currency !== 'USD' || !sale.dueDate) return false
                  const daysOverdue = Math.floor((today - new Date(`${sale.dueDate}T00:00:00`).getTime()) / 86_400_000)
                  return daysOverdue > 30
                }).reduce((total, sale) => total + Math.max(0, getInvoiceOutstanding(sale, receipts)), 0)
                const unallocatedDebtorUsd = receipts.filter((receipt) =>
                  receipt.customerId === draft.id && receipt.source === 'Debtor collection' && !receipt.invoiceAllocated.trim() && !getReceiptInvoice(receipt, sales) && receipt.currency === 'USD',
                ).reduce((total, receipt) => total + receipt.amount, 0)
                const unallocatedDebtorZiG = receipts.filter((receipt) =>
                  receipt.customerId === draft.id && receipt.source === 'Debtor collection' && !receipt.invoiceAllocated.trim() && !getReceiptInvoice(receipt, sales) && receipt.currency === 'ZiG',
                ).reduce((total, receipt) => total + receipt.amount, 0)
                return (
                  <div className="workflow-row" key={draft.id}>
                    <div className="workflow-row-main">
                      <strong>{draft.customerCode} · {draft.name}</strong>
                      <small>Terms: {draft.termsDays} days · Proposed limit: {draft.proposedCreditLimitUsd === null ? 'not set' : `USD ${draft.proposedCreditLimitUsd.toFixed(2)}`}</small>
                      {connected
                        ? <small>Credit status: {draft.creditStatus ?? 'pending'}{draft.approvedCreditLimitUsd !== null && draft.approvedCreditLimitUsd !== undefined ? ` · Approved limit: USD ${draft.approvedCreditLimitUsd.toFixed(2)}` : ''}{draft.approvedBy ? ` · Decision by ${draft.approvedBy}` : ''}</small>
                        : <small>{draft.approvedBy ? `Approval recorded: ${draft.approvedBy} on ${draft.approvalDate} (not verified)` : 'Credit approval pending / not recorded'}</small>}
                      <small>Open credit balance: USD {balanceUsd.toFixed(2)} · ZiG {balanceZiG.toFixed(2)}</small>
                      <small>Over 30 days overdue (USD): {overdueUsd.toFixed(2)} · {customerSales.length} linked credit invoice(s)</small>
                      <small>Unallocated debtor receipts (not deducted): USD {unallocatedDebtorUsd.toFixed(2)} · ZiG {unallocatedDebtorZiG.toFixed(2)}</small>
                    </div>
                    {connected && role === 'managing_director' && (draft.creditStatus === 'pending' || !draft.creditStatus) && (
                      <CreditDecisionControls customer={draft} onDecision={onCreditDecision} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <p className="form-note workflow-warning">{connected ? 'Balances use the authenticated server’s linked sales and receipts. Check original documents; this screen does not replace formal aged-debtor review.' : 'Balances derive from linked local credit-sale and receipt drafts. Paper documents and approvals are not verified; this is not authoritative ageing.'}</p>
        </article>
      </div>
      {connected && localDrafts.length > 0 && (
        <LocalDraftNotice label="Customers" count={localDrafts.length}>
          {localDrafts.map((draft) => `${draft.customerCode} · ${draft.name}`)}
        </LocalDraftNotice>
      )}
    </div>
  )
}

function getCashCloseTotals(draft: CashCloseDraft, receipts: ReceiptDraft[], payments: PaymentDraft[]) {
  if (draft.serverSnapshot) {
    const snapshot = draft.serverSnapshot
    return {
      expectedUsd: snapshot.expectedUsd,
      expectedZiG: snapshot.expectedZiG,
      varianceUsd: snapshot.varianceUsd,
      varianceZiG: snapshot.varianceZiG,
      status: snapshot.statusUsd !== 'OK' ? snapshot.statusUsd : snapshot.statusZiG,
      statusUsd: snapshot.statusUsd,
      statusZiG: snapshot.statusZiG,
      cashReceiptsUsd: snapshot.cashReceiptsUsd,
      cashPaymentsUsd: snapshot.cashPaymentsUsd,
      cashReceiptsZiG: snapshot.cashReceiptsZiG,
      cashPaymentsZiG: snapshot.cashPaymentsZiG,
    }
  }
  const receiptTotal = (currency: Currency, destination: ReceiptDestination) => receipts
    .filter((receipt) => receipt.receiptDate === draft.date && receipt.method === 'Cash' && receipt.receivedInto === destination && receipt.currency === currency)
    .reduce((total, receipt) => total + receipt.amount, 0)
  const paymentTotal = (currency: Currency, paidFrom: string) => payments
    .filter((payment) => payment.paidDate === draft.date && payment.method === 'Cash' && payment.paidFrom.trim().toLocaleLowerCase() === paidFrom.toLocaleLowerCase() && payment.currency === currency)
    .reduce((total, payment) => total + payment.amount, 0)
  const expectedUsd = draft.openingUsd + receiptTotal('USD', 'Till USD') + draft.depositsUsd - paymentTotal('USD', 'Till USD') - draft.withdrawalsUsd
  const expectedZiG = draft.openingZiG + receiptTotal('ZiG', 'Till ZiG') + draft.depositsZiG - paymentTotal('ZiG', 'Till ZiG') - draft.withdrawalsZiG
  const varianceUsd = draft.actualUsd === null ? null : draft.actualUsd - expectedUsd
  const varianceZiG = draft.actualZiG === null ? null : draft.actualZiG - expectedZiG
  const missingCount = varianceUsd === null || varianceZiG === null
  const hasVariance = (varianceUsd !== null && Math.abs(varianceUsd) >= 0.01) || (varianceZiG !== null && Math.abs(varianceZiG) >= 0.01)
  return {
    expectedUsd,
    expectedZiG,
    varianceUsd,
    varianceZiG,
    status: missingCount ? 'COUNT MISSING' : hasVariance ? 'VARIANCE - LOG EXCEPTION' : 'OK',
    statusUsd: varianceUsd === null ? 'COUNT MISSING' : Math.abs(varianceUsd) >= 0.01 ? 'VARIANCE - LOG EXCEPTION' : 'OK',
    statusZiG: varianceZiG === null ? 'COUNT MISSING' : Math.abs(varianceZiG) >= 0.01 ? 'VARIANCE - LOG EXCEPTION' : 'OK',
    cashReceiptsUsd: receiptTotal('USD', 'Till USD'),
    cashPaymentsUsd: paymentTotal('USD', 'Till USD'),
    cashReceiptsZiG: receiptTotal('ZiG', 'Till ZiG'),
    cashPaymentsZiG: paymentTotal('ZiG', 'Till ZiG'),
  }
}

function CashCloseView({
  drafts,
  localDrafts,
  receipts,
  payments,
  connected,
  online,
  loading,
  onSaveDraft,
  onUploadDraft,
  onDismissDraft,
}: {
  drafts: CashCloseDraft[]
  localDrafts: CashCloseDraft[]
  receipts: ReceiptDraft[]
  payments: PaymentDraft[]
  connected: boolean
  online: boolean
  loading: boolean
  onSaveDraft: (draft: CashCloseDraft) => Promise<void>
  onUploadDraft: (id: string) => Promise<void>
  onDismissDraft: (id: string) => void
}) {
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID())
  const [date, setDate] = useState(getLocalDate())
  const [openingUsd, setOpeningUsd] = useState('')
  const [withdrawalsUsd, setWithdrawalsUsd] = useState('0')
  const [depositsUsd, setDepositsUsd] = useState('0')
  const [actualUsd, setActualUsd] = useState('')
  const [openingZiG, setOpeningZiG] = useState('')
  const [withdrawalsZiG, setWithdrawalsZiG] = useState('0')
  const [depositsZiG, setDepositsZiG] = useState('0')
  const [actualZiG, setActualZiG] = useState('')
  const [preparedBy, setPreparedBy] = useState('')
  const [witness, setWitness] = useState('')
  const [exceptionRef, setExceptionRef] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if ([...drafts, ...localDrafts].some((draft) => draft.date === date)) {
      setError('A cash close already exists for this date. Add an exception update rather than creating a duplicate.')
      return
    }
    const numericValues = [openingUsd, withdrawalsUsd, depositsUsd, openingZiG, withdrawalsZiG, depositsZiG]
    if (numericValues.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)
      || (actualUsd !== '' && (!Number.isFinite(Number(actualUsd)) || Number(actualUsd) < 0))
      || (actualZiG !== '' && (!Number.isFinite(Number(actualZiG)) || Number(actualZiG) < 0))) {
      setError('Enter valid non-negative cash amounts.')
      return
    }
    const draft: CashCloseDraft = {
      id: submissionId,
      date,
      openingUsd: Number(openingUsd),
      withdrawalsUsd: Number(withdrawalsUsd),
      depositsUsd: Number(depositsUsd),
      actualUsd: actualUsd === '' ? null : Number(actualUsd),
      openingZiG: Number(openingZiG),
      withdrawalsZiG: Number(withdrawalsZiG),
      depositsZiG: Number(depositsZiG),
      actualZiG: actualZiG === '' ? null : Number(actualZiG),
      preparedBy: preparedBy.trim(),
      witness: witness.trim(),
      exceptionRef: exceptionRef.trim(),
      createdAt: new Date().toISOString(),
    }
    const totals = getCashCloseTotals(draft, receipts, payments)
    if (totals.status === 'VARIANCE - LOG EXCEPTION' && !draft.exceptionRef) {
      setError('Record an exception reference before saving a cash variance.')
      return
    }

    try {
      setSaving(true)
      await onSaveDraft(draft)
      setSubmissionId(crypto.randomUUID())
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Cash close was not saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="content">
      <section className="welcome module-welcome">
        <div><span className="eyebrow">OPERATIONS MODULE</span><h2>Cash Close</h2></div>
      </section>
      <div className="workflow-layout">
        <article className="panel">
          <div className="panel-head"><div><span>{connected && navigator.onLine ? 'SERVER VALIDATED' : connected ? 'OFFLINE LOCAL DRAFT' : 'LOCAL CAPTURE'}</span><h3>Daily till close</h3></div></div>
          <form className="workflow-form" onSubmit={submitDraft}>
            <label>Close date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
            <p className="form-note">{connected ? 'Server expected totals use same-date cash receipts to the till and MD-approved cash vouchers paid from the till. Local drafts are excluded.' : 'Cash totals include only same-date local drafts with method Cash and exact destination/source Till USD or Till ZiG. POS, mobile money, and bank receipts are excluded.'}</p>
            <div className="cash-currency-group">
              <strong>USD till</strong>
              <div className="receipt-fields">
                <label>Opening float<input type="number" value={openingUsd} onChange={(event) => setOpeningUsd(event.target.value)} min="0" step="0.01" required /></label>
                <label>Cash withdrawals to till<input type="number" value={depositsUsd} onChange={(event) => setDepositsUsd(event.target.value)} min="0" step="0.01" required /></label>
              </div>
              <div className="receipt-fields">
                <label>Cash deposits to bank<input type="number" value={withdrawalsUsd} onChange={(event) => setWithdrawalsUsd(event.target.value)} min="0" step="0.01" required /></label>
                <label>Physical count (blank if missing)<input type="number" value={actualUsd} onChange={(event) => setActualUsd(event.target.value)} min="0" step="0.01" /></label>
              </div>
            </div>
            <div className="cash-currency-group">
              <strong>ZiG till</strong>
              <div className="receipt-fields">
                <label>Opening float<input type="number" value={openingZiG} onChange={(event) => setOpeningZiG(event.target.value)} min="0" step="0.01" required /></label>
                <label>Cash withdrawals to till<input type="number" value={depositsZiG} onChange={(event) => setDepositsZiG(event.target.value)} min="0" step="0.01" required /></label>
              </div>
              <div className="receipt-fields">
                <label>Cash deposits to bank<input type="number" value={withdrawalsZiG} onChange={(event) => setWithdrawalsZiG(event.target.value)} min="0" step="0.01" required /></label>
                <label>Physical count (blank if missing)<input type="number" value={actualZiG} onChange={(event) => setActualZiG(event.target.value)} min="0" step="0.01" /></label>
              </div>
            </div>
            <div className="receipt-fields">
              <label>Prepared by<input value={preparedBy} onChange={(event) => setPreparedBy(event.target.value)} required maxLength={80} /></label>
              <label>Witness<input value={witness} onChange={(event) => setWitness(event.target.value)} required maxLength={80} /></label>
            </div>
            <label>Exception reference (required for variance)<input value={exceptionRef} onChange={(event) => setExceptionRef(event.target.value)} maxLength={80} /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : connected && navigator.onLine ? 'Save to server' : connected ? 'Save offline draft' : 'Save local cash close'}</button>
          </form>
        </article>
        <article className="panel">
          <div className="panel-head"><div><span>{connected ? 'SERVER RECONCILIATION SNAPSHOTS' : 'UNVALIDATED LOCAL CALCULATION'}</span><h3>Cash closes <small>{drafts.length}</small></h3></div></div>
          {drafts.length === 0 ? <p className="empty-drafts">No cash closes yet.</p> : (
            <div className="workflow-list">
              {drafts.slice().sort((a, b) => b.date.localeCompare(a.date)).map((draft) => {
                const totals = getCashCloseTotals(draft, receipts, payments)
                return (
                  <div className="workflow-row" key={draft.id}>
                    <div className="workflow-row-main">
                      <strong>{draft.date} · {totals.status}</strong>
                      <small>USD receipts {totals.cashReceiptsUsd.toFixed(2)} · payments {totals.cashPaymentsUsd.toFixed(2)} · expected {totals.expectedUsd.toFixed(2)} · counted {draft.actualUsd === null ? 'missing' : draft.actualUsd.toFixed(2)} · variance {totals.varianceUsd === null ? 'n/a' : totals.varianceUsd.toFixed(2)} · {totals.statusUsd}</small>
                      <small>ZiG receipts {totals.cashReceiptsZiG.toFixed(2)} · payments {totals.cashPaymentsZiG.toFixed(2)} · expected {totals.expectedZiG.toFixed(2)} · counted {draft.actualZiG === null ? 'missing' : draft.actualZiG.toFixed(2)} · variance {totals.varianceZiG === null ? 'n/a' : totals.varianceZiG.toFixed(2)} · {totals.statusZiG}</small>
                      <small>Prepared by {draft.preparedBy} · Witness {draft.witness}{draft.exceptionRef ? ` · Exception ${draft.exceptionRef}` : ''}</small>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <p className="form-note workflow-warning">{connected ? 'Server totals are snapshots from recorded receipts and MD-approved vouchers; they are not a bank reconciliation or proof that source documents are complete.' : 'Expected totals use browser-local drafts only; they are not reconciled or validated against source books or the workbook.'}</p>
        </article>
      </div>
      {connected && localDrafts.length > 0 && (
        <LocalDraftOutbox
          label="Cash Close"
          online={online}
          onUpload={onUploadDraft}
          onDismiss={onDismissDraft}
          entries={localDrafts.map((draft) => ({
            id: draft.id,
            title: `${draft.date} · Cash Close`,
            summary: `Opening USD ${draft.openingUsd.toFixed(2)}, counted ${draft.actualUsd?.toFixed(2) ?? 'not recorded'}; opening ZiG ${draft.openingZiG.toFixed(2)}, counted ${draft.actualZiG?.toFixed(2) ?? 'not recorded'}; prepared by ${draft.preparedBy}, witness ${draft.witness}${draft.exceptionRef ? `; exception ${draft.exceptionRef}` : ''}. Server recalculates totals.`,
          }))}
        />
      )}
    </div>
  )
}

function StockControlView({
  drafts,
  localDrafts,
  connected,
  online,
  loading,
  onSaveDraft,
  onUploadDraft,
  onDismissDraft,
}: {
  drafts: StockMovementDraft[]
  localDrafts: StockMovementDraft[]
  connected: boolean
  online: boolean
  loading: boolean
  onSaveDraft: (draft: StockMovementDraft) => Promise<void>
  onUploadDraft: (id: string) => Promise<void>
  onDismissDraft: (id: string) => void
}) {
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID())
  const [date, setDate] = useState(getLocalDate())
  const [itemCode, setItemCode] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [movementType, setMovementType] = useState<StockMovementType>(stockMovementTypes[1])
  const [sourceReference, setSourceReference] = useState('')
  const [quantityIn, setQuantityIn] = useState('')
  const [quantityOut, setQuantityOut] = useState('')
  const [unitCostUsd, setUnitCostUsd] = useState('')
  const [enteredBy, setEnteredBy] = useState('')
  const [checkedBy, setCheckedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedIn = quantityIn === '' ? 0 : Number(quantityIn)
    const parsedOut = quantityOut === '' ? 0 : Number(quantityOut)
    const parsedCost = unitCostUsd === '' ? null : Number(unitCostUsd)
    if ((parsedIn > 0) === (parsedOut > 0) || parsedIn < 0 || parsedOut < 0
      || !Number.isFinite(parsedIn) || !Number.isFinite(parsedOut)) {
      setError('Enter exactly one positive quantity: quantity in or quantity out.')
      return
    }
    if (parsedCost !== null && (!Number.isFinite(parsedCost) || parsedCost < 0)) {
      setError('Unit cost must be zero or greater.')
      return
    }
    if (movementType === 'Approved adjustment' && !checkedBy.trim()) {
      setError('An approver/checker must be recorded for an adjustment. Approval is not verified here.')
      return
    }

    try {
      setSaving(true)
      await onSaveDraft({
        id: submissionId,
        date,
        itemCode: itemCode.trim(),
        description: description.trim(),
        location: location.trim(),
        movementType,
        sourceReference: sourceReference.trim(),
        quantityIn: parsedIn,
        quantityOut: parsedOut,
        unitCostUsd: parsedCost,
        enteredBy: enteredBy.trim(),
        checkedBy: checkedBy.trim(),
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      })
      setSubmissionId(crypto.randomUUID())
      setItemCode('')
      setDescription('')
      setLocation('')
      setSourceReference('')
      setQuantityIn('')
      setQuantityOut('')
      setUnitCostUsd('')
      setEnteredBy('')
      setCheckedBy('')
      setNotes('')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Stock movement was not saved.')
    } finally {
      setSaving(false)
    }
  }

  const netQuantity = drafts.reduce((totals, draft) => {
    const key = `${draft.itemCode.toLocaleLowerCase()}|${draft.location.toLocaleLowerCase()}`
    const previous = totals.get(key) ?? { item: draft, quantity: 0 }
    previous.quantity += draft.quantityIn - draft.quantityOut
    totals.set(key, previous)
    return totals
  }, new Map<string, { item: StockMovementDraft; quantity: number }>())

  return (
    <div className="content">
      <section className="welcome module-welcome">
        <div><span className="eyebrow">OPERATIONS MODULE</span><h2>Stock</h2></div>
      </section>
      <div className="workflow-layout">
        <article className="panel">
          <div className="panel-head"><div><span>{connected && navigator.onLine ? 'SERVER REGISTER · CONTROLLED ITEMS ONLY' : connected ? 'OFFLINE LOCAL DRAFT' : 'CONTROLLED ITEMS ONLY'}</span><h3>New stock movement</h3></div></div>
          <form className="workflow-form" onSubmit={submitDraft}>
            <label>Movement date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
            <div className="receipt-fields">
              <label>Item code<input value={itemCode} onChange={(event) => setItemCode(event.target.value)} required maxLength={40} /></label>
              <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} required maxLength={80} /></label>
            </div>
            <label>Item description<input value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={120} /></label>
            <label>Movement type
              <select value={movementType} onChange={(event) => setMovementType(event.target.value as StockMovementType)}>
                {stockMovementTypes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>Source document reference<input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} required maxLength={100} /></label>
            <div className="receipt-fields">
              <label>Quantity in (leave blank if none)<input type="number" value={quantityIn} onChange={(event) => setQuantityIn(event.target.value)} min="0" step="any" /></label>
              <label>Quantity out (leave blank if none)<input type="number" value={quantityOut} onChange={(event) => setQuantityOut(event.target.value)} min="0" step="any" /></label>
            </div>
            <div className="receipt-fields">
              <label>Unit cost (USD, optional)<input type="number" value={unitCostUsd} onChange={(event) => setUnitCostUsd(event.target.value)} min="0" step="0.01" /></label>
              <label>Entered by<input value={enteredBy} onChange={(event) => setEnteredBy(event.target.value)} required maxLength={80} /></label>
            </div>
            <label>{movementType === 'Approved adjustment' ? 'Approver / checker (required)' : 'Checked by (optional)'}
              <input value={checkedBy} onChange={(event) => setCheckedBy(event.target.value)} required={movementType === 'Approved adjustment'} maxLength={100} />
            </label>
            <label>Notes (optional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={240} rows={2} /></label>
            <p className="form-note">Use this ledger only for selected controlled/high-value or exception items; manual SD-06 cards remain primary. Issue and return documents must be retained. Approval names are not verified.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : connected && navigator.onLine ? 'Save to server' : connected ? 'Save offline draft' : 'Save local movement'}</button>
          </form>
        </article>
        <article className="panel">
          <div className="panel-head"><div><span>{connected ? 'SERVER MOVEMENT REGISTER' : 'LOCAL MOVEMENT REGISTER'}</span><h3>Stock movements <small>{drafts.length}</small></h3></div></div>
          {drafts.length === 0 ? <p className="empty-drafts">No stock movements yet.</p> : (
            <div className="workflow-list">
              {Array.from(netQuantity.values()).map(({ item, quantity }) => (
                <div className="workflow-row" key={`${item.itemCode}-${item.location}`}>
                  <div className="workflow-row-main">
                    <strong>{item.itemCode} · {item.description}</strong>
                    <small>{item.location} · {connected ? 'Server' : 'Local'} movement balance: {quantity}</small>
                  </div>
                </div>
              ))}
              {drafts.slice().reverse().map((draft) => (
                <div className="workflow-row" key={draft.id}>
                  <div className="workflow-row-main">
                    <strong>{draft.date} · {draft.itemCode} · {draft.movementType}</strong>
                    <small>{draft.description} · {draft.location} · Ref: {draft.sourceReference}</small>
                    <small>In {draft.quantityIn} · Out {draft.quantityOut} · Entered by {draft.enteredBy}{draft.checkedBy ? ` · Checked by ${draft.checkedBy}` : ''}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="form-note workflow-warning">{connected ? 'This ledger is only for selected controlled/high-value or exception items; manual SD-06 cards remain primary. Corrections are new movements, not edits.' : 'Local quantities are not reconciled to physical counts, SD-06 cards, or server stock. Corrections should be entered as traceable movements, not deleted.'}</p>
        </article>
      </div>
      {connected && localDrafts.length > 0 && (
        <LocalDraftOutbox
          label="Stock"
          online={online}
          onUpload={onUploadDraft}
          onDismiss={onDismissDraft}
          entries={localDrafts.map((draft) => ({
            id: draft.id,
            title: `${draft.date} · ${draft.itemCode} · ${draft.movementType}`,
            summary: `${draft.description} at ${draft.location}; source ${draft.sourceReference}; quantity in ${draft.quantityIn}, out ${draft.quantityOut}; entered by ${draft.enteredBy}${draft.checkedBy ? `; checked by ${draft.checkedBy}` : ''}${draft.notes ? `; ${draft.notes}` : ''}.`,
          }))}
        />
      )}
    </div>
  )
}

function ExceptionsView({
  drafts,
  localDrafts,
  connected,
  online,
  loading,
  role,
  username,
  onSaveDraft,
  onSaveUpdate,
  onUploadDraft,
  onDismissDraft,
}: {
  drafts: ExceptionDraft[]
  localDrafts: ExceptionDraft[]
  connected: boolean
  online: boolean
  loading: boolean
  role: ApiUser['role']
  username: string
  onSaveDraft: (draft: ExceptionDraft) => Promise<void>
  onSaveUpdate: (exceptionId: string, update: ExceptionUpdate) => Promise<void>
  onUploadDraft: (id: string) => Promise<void>
  onDismissDraft: (id: string) => void
}) {
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID())
  const [updateSubmissionId, setUpdateSubmissionId] = useState(() => crypto.randomUUID())
  const [exceptionId, setExceptionId] = useState('')
  const [raisedDate, setRaisedDate] = useState(getLocalDate())
  const [area, setArea] = useState('')
  const [sourceReference, setSourceReference] = useState('')
  const [issue, setIssue] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<Currency | ''>('')
  const [owner, setOwner] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedExceptionId, setSelectedExceptionId] = useState('')
  const [status, setStatus] = useState<ExceptionStatus>('In progress')
  const [action, setAction] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [closedDate, setClosedDate] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const allDrafts = [...drafts, ...localDrafts]

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if ([...drafts, ...localDrafts].some((draft) => draft.exceptionId.trim().toLocaleLowerCase() === exceptionId.trim().toLocaleLowerCase())) {
      setError('That exception ID is already recorded.')
      return
    }
    const parsedAmount = amount === '' ? null : Number(amount)
    if ((parsedAmount === null) !== (currency === '')) {
      setError('Select a currency when an amount is entered.')
      return
    }
    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      setError('Amount must be zero or greater.')
      return
    }
    if (dueDate < raisedDate) {
      setError('Due date cannot be before the raised date.')
      return
    }
    try {
      setSaving(true)
      await onSaveDraft({
        id: submissionId,
        exceptionId: exceptionId.trim(),
        raisedDate,
        area: area.trim(),
        sourceReference: sourceReference.trim(),
        issue: issue.trim(),
        amount: parsedAmount,
        currency,
        owner: owner.trim(),
        dueDate,
        updates: [],
        createdAt: new Date().toISOString(),
        status: 'Open',
      })
      setSubmissionId(crypto.randomUUID())
      setExceptionId('')
      setArea('')
      setSourceReference('')
      setIssue('')
      setAmount('')
      setCurrency('')
      setOwner('')
      setDueDate('')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Exception was not saved.')
    } finally {
      setSaving(false)
    }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const selected = allDrafts.find((draft) => draft.id === selectedExceptionId)
    if (!selected) {
      setError('Choose an exception to update.')
      return
    }
    const isServerException = drafts.some((draft) => draft.id === selectedExceptionId)
    if (currentStatus(selected) === 'Closed') {
      setError('Closed exceptions cannot be updated.')
      return
    }
    if (!action.trim() || (!isServerException && !reviewer.trim()) || (status === 'Closed' && !closedDate)) {
      setError('Enter the action and reviewer; a closed exception also requires its closed date.')
      return
    }
    try {
      setSaving(true)
      await onSaveUpdate(selectedExceptionId, {
        id: updateSubmissionId,
        status,
        action: action.trim(),
        reviewer: isServerException ? username : reviewer.trim(),
        closedDate,
        updatedAt: new Date().toISOString(),
      })
      setUpdateSubmissionId(crypto.randomUUID())
      setAction('')
      setReviewer('')
      setClosedDate('')
      setError('')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Exception update was not saved.')
    } finally {
      setSaving(false)
    }
  }

  const currentStatus = (draft: ExceptionDraft) => draft.status ?? draft.updates[draft.updates.length - 1]?.status ?? 'Open'
  const allowedStatuses = connected && role !== 'managing_director'
    ? exceptionStatuses.filter((item) => item === 'Open' || item === 'In progress')
    : exceptionStatuses

  return (
    <div className="content">
      <section className="welcome module-welcome">
        <div><span className="eyebrow">OPERATIONS MODULE</span><h2>Exceptions</h2></div>
      </section>
      <div className="workflow-layout">
        <div className="workflow-stack">
          <article className="panel">
            <div className="panel-head"><div><span>{connected && navigator.onLine ? 'SERVER REGISTER' : connected ? 'OFFLINE LOCAL DRAFT' : 'LOCAL CAPTURE'}</span><h3>Log an exception</h3></div></div>
            <form className="workflow-form" onSubmit={submitDraft}>
              <div className="receipt-fields">
                <label>Exception ID<input value={exceptionId} onChange={(event) => setExceptionId(event.target.value)} required maxLength={40} /></label>
                <label>Raised date<input type="date" value={raisedDate} onChange={(event) => setRaisedDate(event.target.value)} required /></label>
              </div>
              <div className="receipt-fields">
                <label>Area / module<input value={area} onChange={(event) => setArea(event.target.value)} required maxLength={80} /></label>
                <label>Source reference<input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} required maxLength={100} /></label>
              </div>
              <label>Issue / difference<input value={issue} onChange={(event) => setIssue(event.target.value)} required maxLength={240} /></label>
              <div className="amount-fields">
                <label>Amount (optional)<input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} min="0" step="0.01" /></label>
                <label>Currency
                  <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency | '')}>
                    <option value="">Not specified</option><option value="USD">USD</option><option value="ZiG">ZiG</option>
                  </select>
                </label>
              </div>
              <div className="receipt-fields">
                <label>Owner<input value={owner} onChange={(event) => setOwner(event.target.value)} required maxLength={80} /></label>
                <label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : connected && navigator.onLine ? 'Save to server' : connected ? 'Save offline draft' : 'Save local exception'}</button>
            </form>
          </article>
          <article className="panel">
            <div className="panel-head"><div><span>{connected ? 'APPEND-ONLY FOLLOW-UP' : 'APPEND-ONLY LOCAL UPDATES'}</span><h3>Record follow-up</h3></div></div>
            <form className="workflow-form" onSubmit={submitUpdate}>
              <label>Exception
                <select value={selectedExceptionId} onChange={(event) => setSelectedExceptionId(event.target.value)} required>
                  <option value="">Select an exception</option>
                  {allDrafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.exceptionId} · {draft.issue}{localDrafts.some((item) => item.id === draft.id) ? ' · local' : ''}</option>)}
                </select>
              </label>
              <label>Status
                <select value={status} onChange={(event) => {
                  const nextStatus = event.target.value as ExceptionStatus
                  setStatus(nextStatus)
                  if (nextStatus !== 'Closed') setClosedDate('')
                }}>
                  {allowedStatuses.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>Action / evidence / resolution<input value={action} onChange={(event) => setAction(event.target.value)} required maxLength={240} /></label>
              <div className="receipt-fields">
                {(!connected || localDrafts.some((item) => item.id === selectedExceptionId)) ? (
                  <label>Reviewer<input value={reviewer} onChange={(event) => setReviewer(event.target.value)} required maxLength={80} /></label>
                ) : <p className="form-note">Reviewer is recorded from signed-in account: {username}</p>}
                <label>Closed date (required when closed)<input type="date" value={closedDate} onChange={(event) => setClosedDate(event.target.value)} required={status === 'Closed'} /></label>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary" type="submit" disabled={saving || loading || allDrafts.length === 0}>{saving ? 'Saving…' : 'Append update'}</button>
            </form>
          </article>
        </div>
        <article className="panel">
          <div className="panel-head"><div><span>{connected ? 'SERVER REGISTER' : 'LOCAL REGISTER'}</span><h3>Exceptions <small>{drafts.length}</small></h3></div></div>
          {drafts.length === 0 ? <p className="empty-drafts">No exceptions logged.</p> : (
            <div className="workflow-list">
              {drafts.slice().reverse().map((draft) => {
                const overdue = draft.dueDate < getLocalDate() && currentStatus(draft) !== 'Closed'
                return (
                  <div className="workflow-row" key={draft.id}>
                    <div className="workflow-row-main">
                      <strong>{draft.exceptionId} · {draft.area} · {currentStatus(draft)}{overdue ? ' · OVERDUE' : ''}</strong>
                      <small>{draft.raisedDate} · {draft.issue} · Ref: {draft.sourceReference}</small>
                      <small>Owner: {draft.owner} · Due: {draft.dueDate}{draft.amount !== null ? ` · ${draft.currency} ${draft.amount.toFixed(2)}` : ''}</small>
                      {draft.updates.map((update) => (
                        <small key={update.id}>{new Date(update.updatedAt).toLocaleString()} · {update.status} · {update.action} · Reviewer: {update.reviewer}{update.closedDate ? ` · Closed: ${update.closedDate}` : ''}</small>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <p className="form-note workflow-warning">{connected ? 'Updates are append-only in the API and audited. Managing Directors control Awaiting MD and Closed status; database operators can still alter records.' : 'Updates append to the browser-local record; this is not a tamper-proof audit trail. No records are deleted or independently reviewed by a server.'}</p>
        </article>
      </div>
      {connected && localDrafts.length > 0 && (
        <LocalDraftOutbox
          label="Exceptions"
          online={online}
          onUpload={onUploadDraft}
          onDismiss={onDismissDraft}
          entries={localDrafts.map((draft) => ({
            id: draft.id,
            title: `${draft.exceptionId} · ${draft.area} · ${currentStatus(draft)}`,
            summary: `${draft.raisedDate} · ${draft.issue}; source ${draft.sourceReference}; owner ${draft.owner}; due ${draft.dueDate}${draft.amount !== null ? `; ${draft.currency} ${draft.amount.toFixed(2)}` : ''}${draft.updates.length ? `; ${draft.updates.length} queued update(s): ${draft.updates.map((update) => `${update.status} — ${update.action} (${update.reviewer})`).join('; ')}` : ''}.`,
            blockedReason: role !== 'managing_director' && draft.updates.some((update) => update.status === 'Awaiting MD' || update.status === 'Closed')
              ? 'A Managing Director must upload queued Awaiting MD or Closed updates.'
              : undefined,
          }))}
        />
      )}
    </div>
  )
}

function ExchangeRatesView({
  rates,
  connected,
  loading,
  role,
  onSaveRate,
}: {
  rates: ApiApprovedRate[]
  connected: boolean
  loading: boolean
  role: ApiUser['role']
  onSaveRate: (effectiveDate: string, usdPerUnit: string, sourceReference: string) => Promise<void>
}) {
  const [effectiveDate, setEffectiveDate] = useState(getLocalDate())
  const [usdPerUnit, setUsdPerUnit] = useState('')
  const [sourceReference, setSourceReference] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submitRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedRate = Number(usdPerUnit)
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      setError('Enter an exchange rate greater than zero.')
      return
    }
    if (rates.some((rate) => rate.effective_date === effectiveDate)) {
      setError('A ZiG rate already exists for that effective date.')
      return
    }
    try {
      setSaving(true)
      await onSaveRate(effectiveDate, parsedRate.toFixed(8), sourceReference.trim())
      setUsdPerUnit('')
      setSourceReference('')
      setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The approved rate was not saved.')
    } finally {
      setSaving(false)
    }
  }

  const canApprove = connected && role === 'managing_director'

  return (
    <div className="content">
      <section className="welcome module-welcome">
        <div><span className="eyebrow">MANAGED RATE HISTORY</span><h2>Exchange Rates</h2></div>
      </section>
      <div className="workflow-layout">
        <article className="panel">
          <div className="panel-head"><div><span>{canApprove ? 'MD APPROVAL' : connected ? 'VIEW ONLY' : 'SIGN IN REQUIRED'}</span><h3>Add approved ZiG rate</h3></div></div>
          {canApprove ? (
            <form className="workflow-form" onSubmit={submitRate}>
              <label>Currency<input value="ZiG" readOnly /></label>
              <label>Effective from<input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} required /></label>
              <label>USD per ZiG unit<input type="number" value={usdPerUnit} onChange={(event) => setUsdPerUnit(event.target.value)} min="0.00000001" step="0.00000001" required /></label>
              <label>Rate source / MD decision reference<input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} required maxLength={100} /></label>
              <p className="form-note">Rates are append-only by effective date. Adding a later rate closes the previous open period on the prior day; prior transaction snapshots are not changed.</p>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary" type="submit" disabled={saving || loading}>{saving ? 'Saving…' : 'Approve rate'}</button>
            </form>
          ) : (
            <p className="form-note">{connected ? 'Only a Managing Director can approve rates. Contact the MD to add a rate with its source or decision reference.' : 'Sign in to view the approved rate history. Rate approval is restricted to the Managing Director.'}</p>
          )}
        </article>
        <article className="panel">
          <div className="panel-head"><div><span>APPROVED HISTORY</span><h3>ZiG rates <small>{rates.length}</small></h3></div></div>
          {loading ? <p className="empty-drafts">Loading approved rates…</p> : rates.length === 0 ? <p className="empty-drafts">No approved ZiG rates recorded.</p> : (
            <div className="workflow-list">
              {rates.map((rate) => (
                <div className="workflow-row" key={rate.id}>
                  <div className="workflow-row-main">
                    <strong>ZiG {rate.usd_per_unit} USD per unit</strong>
                    <small>{rate.effective_date} to {rate.effective_to ?? 'open period'} · Approved by {rate.approved_by_username}</small>
                    <small>Source / decision: {rate.source_reference}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="form-note workflow-warning">Transactions retain their approved rate snapshot. Rates should be entered from documented MD approval; this interface does not verify the external rate source.</p>
        </article>
      </div>
    </div>
  )
}

function ModuleView({ name }: { name: ModuleName }) {
  return (
    <div className="content">
      <section className="welcome module-welcome">
        <div><span className="eyebrow">OPERATIONS MODULE</span><h2>{name}</h2></div>
      </section>
      <article className="panel module-placeholder">
        <div className="placeholder-icon">✓</div>
        <h3>{name} is planned for a later workflow</h3>
        <p>This module is a prototype placeholder. Its controlled fields, approvals, audit records and synchronisation rules still need to be mapped to the approved Phase 1 specification.</p>
      </article>
    </div>
  )
}
