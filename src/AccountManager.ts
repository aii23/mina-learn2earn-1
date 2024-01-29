import {
  Field,
  MerkleMap,
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
import { Gadgets } from 'o1js/dist/node/lib/gadgets/gadgets';

export enum AccountState {
  NotListed,
  Listed,
  Participated,
}

export class SpyState extends Struct({
  state: Field,
  message: Field,
}) {
  static listed(): SpyState {
    return new SpyState({
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

  @method init() {
    super.init();

    this.root.set(new MerkleMap().getRoot());
    this.administrator.set(PublicKey.empty());
  }

  @method setAdministrator(administrator: PublicKey) {
    const curAdministrator = this.administrator.getAndRequireEquals();
    curAdministrator.assertEquals(PublicKey.empty());
    this.administrator.set(administrator);
  }

  @method addAccount(address: PublicKey, path: MerkleMapWitness) {
    // Check for administrator
    const administrator = this.administrator.getAndRequireEquals();
    administrator.assertEquals(this.sender);

    const root = this.root.getAndRequireEquals();
    const accountHash = Poseidon.hash(address.toFields());

    const [rootBefore, key] = path.computeRootAndKey(Field.from(0)); // No values yet

    root.assertEquals(rootBefore);
    key.assertEquals(accountHash);

    const [newRoot] = path.computeRootAndKey(SpyState.listed().hash());

    this.root.set(newRoot);
  }

  @method addMessage(path: MerkleMapWitness, message: Field) {
    // Check message for flags

    {
      let f1 = Gadgets.and(message, Field.from(1), 1).equals(Field.from(1));
      let f2 = Gadgets.and(message, Field.from(1 << 1), 2).equals(
        Field.from(1 << 1)
      );
      let f3 = Gadgets.and(message, Field.from(1 << 2), 3).equals(
        Field.from(1 << 2)
      );
      let f4 = Gadgets.and(message, Field.from(1 << 3), 4).equals(
        Field.from(1 << 3)
      );
      let f5 = Gadgets.and(message, Field.from(1 << 4), 5).equals(
        Field.from(1 << 4)
      );
      let f6 = Gadgets.and(message, Field.from(1 << 5), 6).equals(
        Field.from(1 << 5)
      );
      // First rule
      f1.not().or(f2.or(f3).or(f4).or(f5).or(f6).not()).assertTrue();
      // Second Rule
      f2.not().or(f3).assertTrue();
      // Third rule
      f4.not().or(f5.not().and(f6.not())).assertTrue();
    }

    const root = this.root.getAndRequireEquals();
    const accountHash = Poseidon.hash(this.sender.toFields());
    const [rootBefore, key] = path.computeRootAndKey(SpyState.listed().hash());

    root.assertEquals(rootBefore);
    key.assertEquals(accountHash);

    const newValue = new SpyState({
      state: Field.from(AccountState.Participated),
      message,
    });

    const [newRoot] = path.computeRootAndKey(newValue.hash());
    this.root.set(newRoot);
  }
}
