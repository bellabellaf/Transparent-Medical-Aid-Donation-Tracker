;; FundAllocationContract.clar
;; Manages allocation of donated funds to disaster regions or needs
;; Integrates with DonationContract for fund withdrawal and ensures transparency

;; Constants
(define-constant ERR-UNAUTHORIZED u200)
(define-constant ERR-INVALID-AMOUNT u201)
(define-constant ERR-ALLOCATION-NOT-FOUND u202)
(define-constant ERR-ALLOCATION-CLOSED u203)
(define-constant ERR-INSUFFICIENT-FUNDS u204)
(define-constant ERR-INVALID-APPROVER u205)
(define-constant ERR-ALREADY-APPROVED u206)
(define-constant ERR-MIN-APPROVALS-NOT-MET u207)
(define-constant ERR-INVALID-METADATA u208)
(define-constant ERR-DONATION-CONTRACT-FAIL u209)
(define-constant ERR-INVALID-RECIPIENT u210)
(define-constant ERR-INVALID-CAMPAIGN u211)
(define-constant MAX-METADATA-LEN u500)
(define-constant MAX-APPROVERS u5)
(define-constant MIN-APPROVALS u2)

;; Data Variables
(define-data-var contract-admin principal tx-sender)
(define-data-var donation-contract principal tx-sender) ;; Set to DonationContract address
(define-data-var paused bool false)
(define-data-var allocation-counter uint u0)

;; Data Maps
(define-map allocations
  { allocation-id: uint }
  {
    campaign-id: uint,
    recipient: principal, ;; Supplier or hospital
    amount: uint,
    purpose: (string-utf8 500), ;; e.g., "Pharmaceuticals for Region X"
    created-at: uint,
    closed: bool,
    approvals: (list 5 principal),
    approval-count: uint,
    executed: bool
  }
)

(define-map approvers
  { allocation-id: uint, approver: principal }
  { approved: bool, timestamp: uint }
)

;; Private Functions
(define-private (is-admin (caller principal))
  (is-eq caller (var-get contract-admin))
)

(define-private (is-valid-approver (allocation-id uint) (approver principal))
  (let ((allocation (unwrap! (map-get? allocations {allocation-id: allocation-id}) false)))
    (is-some (index-of (get approvals allocation) approver))
  )
)

(define-private (call-donation-contract-withdraw (campaign-id uint) (recipient principal) (amount uint))
  ;; Mock call to DonationContract's withdraw-funds (in real deployment, use contract-call?)
  (ok true)
)

;; Public Functions

;; Admin: Set new admin
(define-public (set-admin (new-admin principal))
  (if (is-admin tx-sender)
    (begin
      (var-set contract-admin new-admin)
      (ok true)
    )
    (err ERR-UNAUTHORIZED)
  )
)

;; Admin: Set donation contract address
(define-public (set-donation-contract (contract principal))
  (if (is-admin tx-sender)
    (begin
      (var-set donation-contract contract)
      (ok true)
    )
    (err ERR-UNAUTHORIZED)
  )
)

;; Admin: Pause contract
(define-public (pause-contract)
  (if (is-admin tx-sender)
    (begin
      (var-set paused true)
      (ok true)
    )
    (err ERR-UNAUTHORIZED)
  )
)

;; Admin: Unpause contract
(define-public (unpause-contract)
  (if (is-admin tx-sender)
    (begin
      (var-set paused false)
      (ok true)
    )
    (err ERR-UNAUTHORIZED)
  )
)

;; Create allocation for a campaign
(define-public (create-allocation
  (campaign-id uint)
  (recipient principal)
  (amount uint)
  (purpose (string-utf8 500))
  (approvers (list 5 principal)))
  (let ((new-id (+ (var-get allocation-counter) u1)))
    (asserts! (not (var-get paused)) (err ERR-UNAUTHORIZED))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (<= (len purpose) MAX-METADATA-LEN) (err ERR-INVALID-METADATA))
    (asserts! (<= (len approvers) MAX-APPROVERS) (err ERR-INVALID-APPROVER))
    (asserts! (>= (len approvers) MIN-APPROVALS) (err ERR-MIN-APPROVALS-NOT-MET))
    (asserts! (not (is-eq recipient (as-contract tx-sender))) (err ERR-INVALID-RECIPIENT))
    (map-set allocations
      { allocation-id: new-id }
      {
        campaign-id: campaign-id,
        recipient: recipient,
        amount: amount,
        purpose: purpose,
        created-at: block-height,
        closed: false,
        approvals: approvers,
        approval-count: u0,
        executed: false
      }
    )
    (var-set allocation-counter new-id)
    (print { event: "allocation-created", id: new-id, campaign-id: campaign-id, recipient: recipient, amount: amount })
    (ok new-id)
  )
)

;; Approve allocation
(define-public (approve-allocation (allocation-id uint))
  (let ((allocation (unwrap! (map-get? allocations {allocation-id: allocation-id}) (err ERR-ALLOCATION-NOT-FOUND))))
    (asserts! (not (var-get paused)) (err ERR-UNAUTHORIZED))
    (asserts! (not (get closed allocation)) (err ERR-ALLOCATION-CLOSED))
    (asserts! (is-valid-approver allocation-id tx-sender) (err ERR-INVALID-APPROVER))
    (asserts! (not (get approved (unwrap! (map-get? approvers {allocation-id: allocation-id, approver: tx-sender}) (err ERR-INVALID-APPROVER)))) (err ERR-ALREADY-APPROVED))
    (map-set approvers
      { allocation-id: allocation-id, approver: tx-sender }
      { approved: true, timestamp: block-height }
    )
    (map-set allocations
      { allocation-id: allocation-id }
      (merge allocation { approval-count: (+ (get approval-count allocation) u1) })
    )
    (print { event: "allocation-approved", allocation-id: allocation-id, approver: tx-sender })
    (ok true)
  )
)

;; Execute allocation (transfer funds after approvals)
(define-public (execute-allocation (allocation-id uint))
  (let ((allocation (unwrap! (map-get? allocations {allocation-id: allocation-id}) (err ERR-ALLOCATION-NOT-FOUND))))
    (asserts! (not (var-get paused)) (err ERR-UNAUTHORIZED))
    (asserts! (not (get closed allocation)) (err ERR-ALLOCATION-CLOSED))
    (asserts! (not (get executed allocation)) (err ERR-ALREADY-APPROVED))
    (asserts! (>= (get approval-count allocation) MIN-APPROVALS) (err ERR-MIN-APPROVALS-NOT-MET))
    ;; Call DonationContract to withdraw funds
    (try! (call-donation-contract-withdraw (get campaign-id allocation) (get recipient allocation) (get amount allocation)))
    (map-set allocations
      { allocation-id: allocation-id }
      (merge allocation { executed: true, closed: true })
    )
    (print { event: "allocation-executed", id: allocation-id, recipient: (get recipient allocation), amount: (get amount allocation) })
    (ok true)
  )
)

;; Close allocation without execution (e.g., if invalid)
(define-public (close-allocation (allocation-id uint))
  (let ((allocation (unwrap! (map-get? allocations {allocation-id: allocation-id}) (err ERR-ALLOCATION-NOT-FOUND))))
    (asserts! (or (is-admin tx-sender) (is-eq tx-sender (get recipient allocation))) (err ERR-UNAUTHORIZED))
    (asserts! (not (get closed allocation)) (err ERR-ALLOCATION-CLOSED))
    (map-set allocations
      { allocation-id: allocation-id }
      (merge allocation { closed: true })
    )
    (print { event: "allocation-closed", id: allocation-id })
    (ok true)
  )
)

;; Read-only Functions

(define-read-only (get-allocation-details (allocation-id uint))
  (map-get? allocations {allocation-id: allocation-id})
)

(define-read-only (get-approver-details (allocation-id uint) (approver principal))
  (map-get? approvers {allocation-id: allocation-id, approver: approver})
)

(define-read-only (get-contract-admin)
  (var-get contract-admin)
)

(define-read-only (get-donation-contract)
  (var-get donation-contract)
)

(define-read-only (is-contract-paused)
  (var-get paused)
)

(define-read-only (get-allocation-counter)
  (var-get allocation-counter)
)

;; Event logging helper
(define-private (log-event (event-type (string-ascii 50)) (data (tuple (key (string-ascii 50)) (value uint))))
  (print { type: event-type, data: data })
)