import {
  Field,
  MerkleMapWitness,
  Poseidon,
  PublicKey,
  SmartContract,
  State,
  UInt64,
  method,
  state,
} from 'o1js';

enum AccountState {
  NotListed,
  Listed,
  Participated,
}

export class AccountManager extends SmartContract {
  @state(Field) root = State<Field>();
  @state(Field) messageRoot = State<Field>();
  @state(PublicKey) administrator = State<PublicKey>();
  @state(UInt64) unusedAccounts = State<UInt64>();

  @method addAccount(address: PublicKey, path: MerkleMapWitness) {
    // Check for administrator

    const root = this.root.getAndRequireEquals();

    const accountHash = Poseidon.hash(address.toFields());

    const [rootBefore, key] = path.computeRootAndKey(
      Field.from(AccountState.NotListed)
    );

    root.assertEquals(rootBefore);
    key.assertEquals(accountHash);

    const [newRoot, _] = path.computeRootAndKey(
      Field.from(AccountState.Listed)
    );

    this.root.set(newRoot);
  }

  @method addMessage(
    path: MerkleMapWitness,
    messagePath: MerkleMapWitness,
    message: Field
  ) {
    // Check message for flags

    const root = this.root.getAndRequireEquals();
    const messageRoot = this.messageRoot.getAndRequireEquals();

    const accountHash = Poseidon.hash(this.sender.toFields());

    const [rootBefore, key] = path.computeRootAndKey(
      Field.from(AccountState.Listed)
    );

    root.assertEquals(rootBefore);
    key.assertEquals(accountHash);

    const [messageRootBefore, messageKey] = path.computeRootAndKey(
      Field.from(0)
    );

    messageRoot.assertEquals(messageRootBefore);
    messageKey.assertEquals(accountHash);

    const [newRoot] = path.computeRootAndKey(
      Field.from(AccountState.Participated)
    );

    this.root.set(newRoot);

    // const [newMessageRoot, _] = path.computeRootAndKey(
    //     Field.from(AccountState.Participated)
    //   );
  }
}
