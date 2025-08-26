import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Allocation {
  campaignId: number;
  recipient: string;
  amount: number;
  purpose: string;
  createdAt: number;
  closed: boolean;
  approvals: string[];
  approvalCount: number;
  executed: boolean;
}

interface Approver {
  approved: boolean;
  timestamp: number;
}

interface ContractState {
  admin: string;
  donationContract: string;
  paused: boolean;
  allocationCounter: number;
  allocations: Map<number, Allocation>;
  approvers: Map<string, Approver>; // Key: `${allocationId}_${approver}`
  blockHeight: number;
}

// Mock contract implementation
class FundAllocationContractMock {
  private state: ContractState = {
    admin: "deployer",
    donationContract: "donation-contract",
    paused: false,
    allocationCounter: 0,
    allocations: new Map(),
    approvers: new Map(),
    blockHeight: 100,
  };

  private ERR_UNAUTHORIZED = 200;
  private ERR_INVALID_AMOUNT = 201;
  private ERR_ALLOCATION_NOT_FOUND = 202;
  private ERR_ALLOCATION_CLOSED = 203;
  private ERR_INSUFFICIENT_FUNDS = 204;
  private ERR_INVALID_APPROVER = 205;
  private ERR_ALREADY_APPROVED = 206;
  private ERR_MIN_APPROVALS_NOT_MET = 207;
  private ERR_INVALID_METADATA = 208;
  private ERR_DONATION_CONTRACT_FAIL = 209;
  private ERR_INVALID_RECIPIENT = 210;
  private ERR_INVALID_CAMPAIGN = 211;
  private MAX_METADATA_LEN = 500;
  private MAX_APPROVERS = 5;
  private MIN_APPROVALS = 2;

  // Helper to get approver key
  private getApproverKey(allocationId: number, approver: string): string {
    return `${allocationId}_${approver}`;
  }

  setAdmin(caller: string, newAdmin: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.admin = newAdmin;
    return { ok: true, value: true };
  }

  setDonationContract(caller: string, contract: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.donationContract = contract;
    return { ok: true, value: true };
  }

  pauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = true;
    return { ok: true, value: true };
  }

  unpauseContract(caller: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = false;
    return { ok: true, value: true };
  }

  createAllocation(
    caller: string,
    campaignId: number,
    recipient: string,
    amount: number,
    purpose: string,
    approvers: string[]
  ): ClarityResponse<number> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (amount <= 0) {
      return { ok: false, value: this.ERR_INVALID_AMOUNT };
    }
    if (purpose.length > this.MAX_METADATA_LEN) {
      return { ok: false, value: this.ERR_INVALID_METADATA };
    }
    if (approvers.length > this.MAX_APPROVERS || approvers.length < this.MIN_APPROVALS) {
      return { ok: false, value: this.ERR_MIN_APPROVALS_NOT_MET };
    }
    if (recipient === "contract") {
      return { ok: false, value: this.ERR_INVALID_RECIPIENT };
    }
    const newId = this.state.allocationCounter + 1;
    this.state.allocations.set(newId, {
      campaignId,
      recipient,
      amount,
      purpose,
      createdAt: this.state.blockHeight,
      closed: false,
      approvals: approvers,
      approvalCount: 0,
      executed: false,
    });
    this.state.allocationCounter = newId;
    return { ok: true, value: newId };
  }

  approveAllocation(caller: string, allocationId: number): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const allocation = this.state.allocations.get(allocationId);
    if (!allocation) {
      return { ok: false, value: this.ERR_ALLOCATION_NOT_FOUND };
    }
    if (allocation.closed) {
      return { ok: false, value: this.ERR_ALLOCATION_CLOSED };
    }
    if (!allocation.approvals.includes(caller)) {
      return { ok: false, value: this.ERR_INVALID_APPROVER };
    }
    const approverKey = this.getApproverKey(allocationId, caller);
    const approver = this.state.approvers.get(approverKey);
    if (approver?.approved) {
      return { ok: false, value: this.ERR_ALREADY_APPROVED };
    }
    this.state.approvers.set(approverKey, { approved: true, timestamp: this.state.blockHeight });
    allocation.approvalCount += 1;
    return { ok: true, value: true };
  }

  executeAllocation(caller: string, allocationId: number): ClarityResponse<boolean> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const allocation = this.state.allocations.get(allocationId);
    if (!allocation) {
      return { ok: false, value: this.ERR_ALLOCATION_NOT_FOUND };
    }
    if (allocation.closed) {
      return { ok: false, value: this.ERR_ALLOCATION_CLOSED };
    }
    if (allocation.executed) {
      return { ok: false, value: this.ERR_ALREADY_APPROVED };
    }
    if (allocation.approvalCount < this.MIN_APPROVALS) {
      return { ok: false, value: this.ERR_MIN_APPROVALS_NOT_MET };
    }
    allocation.executed = true;
    allocation.closed = true;
    return { ok: true, value: true };
  }

  closeAllocation(caller: string, allocationId: number): ClarityResponse<boolean> {
    const allocation = this.state.allocations.get(allocationId);
    if (!allocation) {
      return { ok: false, value: this.ERR_ALLOCATION_NOT_FOUND };
    }
    if (allocation.closed) {
      return { ok: false, value: this.ERR_ALLOCATION_CLOSED };
    }
    if (caller !== this.state.admin && caller !== allocation.recipient) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    allocation.closed = true;
    return { ok: true, value: true };
  }

  getAllocationDetails(allocationId: number): ClarityResponse<Allocation | null> {
    return { ok: true, value: this.state.allocations.get(allocationId) ?? null };
  }

  getApproverDetails(allocationId: number, approver: string): ClarityResponse<Approver | null> {
    const key = this.getApproverKey(allocationId, approver);
    return { ok: true, value: this.state.approvers.get(key) ?? null };
  }

  getContractAdmin(): ClarityResponse<string> {
    return { ok: true, value: this.state.admin };
  }

  getDonationContract(): ClarityResponse<string> {
    return { ok: true, value: this.state.donationContract };
  }

  isContractPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getAllocationCounter(): ClarityResponse<number> {
    return { ok: true, value: this.state.allocationCounter };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  creator: "wallet_1",
  approver1: "wallet_2",
  approver2: "wallet_3",
  recipient: "wallet_4",
  unauthorized: "wallet_5",
};

describe("FundAllocationContract", () => {
  let contract: FundAllocationContractMock;

  beforeEach(() => {
    contract = new FundAllocationContractMock();
    vi.resetAllMocks();
  });

  it("should allow admin to set new admin", () => {
    const result = contract.setAdmin(accounts.deployer, accounts.creator);
    expect(result).toEqual({ ok: true, value: true });
    expect(contract.getContractAdmin()).toEqual({ ok: true, value: accounts.creator });
  });

  it("should prevent non-admin from setting admin", () => {
    const result = contract.setAdmin(accounts.unauthorized, accounts.creator);
    expect(result).toEqual({ ok: false, value: 200 });
  });

  it("should allow admin to set donation contract", () => {
    const result = contract.setDonationContract(accounts.deployer, "new-donation-contract");
    expect(result).toEqual({ ok: true, value: true });
    expect(contract.getDonationContract()).toEqual({ ok: true, value: "new-donation-contract" });
  });

  it("should allow creating allocation", () => {
    const approvers = [accounts.approver1, accounts.approver2, accounts.deployer];
    const result = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      1000,
      "Pharmaceuticals for Region X",
      approvers
    );
    expect(result.ok).toBe(true);
    const allocationId = result.value as number;
    const details = contract.getAllocationDetails(allocationId);
    expect(details.value).toEqual(
      expect.objectContaining({
        campaignId: 1,
        recipient: accounts.recipient,
        amount: 1000,
        purpose: "Pharmaceuticals for Region X",
        approvals: approvers,
        approvalCount: 0,
        closed: false,
        executed: false,
      })
    );
  });

  it("should prevent allocation with invalid params", () => {
    const approvers = [accounts.approver1, accounts.approver2];
    const invalidAmount = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      0,
      "Purpose",
      approvers
    );
    expect(invalidAmount).toEqual({ ok: false, value: 201 });

    const invalidMetadata = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      1000,
      "a".repeat(501),
      approvers
    );
    expect(invalidMetadata).toEqual({ ok: false, value: 208 });

    const tooFewApprovers = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      1000,
      "Purpose",
      [accounts.approver1]
    );
    expect(tooFewApprovers).toEqual({ ok: false, value: 207 });
  });

  it("should allow valid approver to approve allocation", () => {
    const approvers = [accounts.approver1, accounts.approver2];
    const createResult = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      1000,
      "Purpose",
      approvers
    );
    const allocationId = createResult.value as number;

    const approveResult = contract.approveAllocation(accounts.approver1, allocationId);
    expect(approveResult).toEqual({ ok: true, value: true });

    const details = contract.getAllocationDetails(allocationId);
    expect(details.value?.approvalCount).toBe(1);

    const approverDetails = contract.getApproverDetails(allocationId, accounts.approver1);
    expect(approverDetails.value?.approved).toBe(true);
  });

  it("should prevent non-approver from approving", () => {
    const approvers = [accounts.approver1, accounts.approver2];
    const createResult = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      1000,
      "Purpose",
      approvers
    );
    const allocationId = createResult.value as number;

    const approveResult = contract.approveAllocation(accounts.unauthorized, allocationId);
    expect(approveResult).toEqual({ ok: false, value: 205 });
  });

  it("should prevent double approval", () => {
    const approvers = [accounts.approver1, accounts.approver2];
    const createResult = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      1000,
      "Purpose",
      approvers
    );
    const allocationId = createResult.value as number;

    contract.approveAllocation(accounts.approver1, allocationId);
    const secondApprove = contract.approveAllocation(accounts.approver1, allocationId);
    expect(secondApprove).toEqual({ ok: false, value: 206 });
  });

  it("should allow execution after minimum approvals", () => {
    const approvers = [accounts.approver1, accounts.approver2];
    const createResult = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      1000,
      "Purpose",
      approvers
    );
    const allocationId = createResult.value as number;

    contract.approveAllocation(accounts.approver1, allocationId);
    contract.approveAllocation(accounts.approver2, allocationId);

    const executeResult = contract.executeAllocation(accounts.creator, allocationId);
    expect(executeResult).toEqual({ ok: true, value: true });

    const details = contract.getAllocationDetails(allocationId);
    expect(details.value?.executed).toBe(true);
    expect(details.value?.closed).toBe(true);
  });

  it("should prevent execution without minimum approvals", () => {
    const approvers = [accounts.approver1, accounts.approver2];
    const createResult = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      1000,
      "Purpose",
      approvers
    );
    const allocationId = createResult.value as number;

    contract.approveAllocation(accounts.approver1, allocationId);

    const executeResult = contract.executeAllocation(accounts.creator, allocationId);
    expect(executeResult).toEqual({ ok: false, value: 207 });
  });

  it("should allow admin to close allocation", () => {
    const approvers = [accounts.approver1, accounts.approver2];
    const createResult = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      1000,
      "Purpose",
      approvers
    );
    const allocationId = createResult.value as number;

    const closeResult = contract.closeAllocation(accounts.deployer, allocationId);
    expect(closeResult).toEqual({ ok: true, value: true });

    const details = contract.getAllocationDetails(allocationId);
    expect(details.value?.closed).toBe(true);
  });

  it("should prevent unauthorized closing", () => {
    const approvers = [accounts.approver1, accounts.approver2];
    const createResult = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      1000,
      "Purpose",
      approvers
    );
    const allocationId = createResult.value as number;

    const closeResult = contract.closeAllocation(accounts.unauthorized, allocationId);
    expect(closeResult).toEqual({ ok: false, value: 200 });
  });

  it("should prevent actions when paused", () => {
    contract.pauseContract(accounts.deployer);

    const createResult = contract.createAllocation(
      accounts.creator,
      1,
      accounts.recipient,
      1000,
      "Purpose",
      [accounts.approver1, accounts.approver2]
    );
    expect(createResult).toEqual({ ok: false, value: 200 });

    contract.unpauseContract(accounts.deployer);
    expect(contract.isContractPaused()).toEqual({ ok: true, value: false });
  });
});