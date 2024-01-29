import {
  Field,
  MerkleMapWitness,
  Poseidon,
  PublicKey,
  SmartContract,
  State,
  Struct,
  UInt64,
  method,
  state,
} from 'o1js';

enum AccountState {
  NotListed,
  Listed,
  Participated,
}

class Account extends Struct({
  state: Field,
  message: Field,
}) {
  static listed(): Account {
    return new Account({
      state: Field.from(AccountState.Listed),
      message: Field.from(0),
    });
  }
  hash(): Field {
    return Poseidon.hash([this.state, this.message]);
  }
}

export class AccountManager extends SmartContract {
  @state(Field) root = State<Field>();
  @state(PublicKey) administrator = State<PublicKey>();
  @state(UInt64) unusedAccounts = State<UInt64>();

  @method addAccount(address: PublicKey, path: MerkleMapWitness) {
    // Check for administrator

    const root = this.root.getAndRequireEquals();

    const accountHash = Poseidon.hash(address.toFields());

    const [rootBefore, key] = path.computeRootAndKey(Field.from(0)); // No values yet

    root.assertEquals(rootBefore);
    key.assertEquals(accountHash);

    const [newRoot, _] = path.computeRootAndKey(Account.listed().hash());

    this.root.set(newRoot);
  }

  @method addMessage(path: MerkleMapWitness, message: Field) {
    // Check message for flags

    const root = this.root.getAndRequireEquals();

    const accountHash = Poseidon.hash(this.sender.toFields());

    const [rootBefore, key] = path.computeRootAndKey(Account.listed().hash());

    root.assertEquals(rootBefore);
    key.assertEquals(accountHash);

    const newValue = new Account({
      state: Field.from(AccountState.Participated),
      message,
    });

    const [newRoot] = path.computeRootAndKey(newValue.hash());

    this.root.set(newRoot);
  }
}
