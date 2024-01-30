import { AccountManager, AccountState, SpyState } from './AccountManager';

import {
  AccountUpdate,
  Field,
  MerkleMap,
  Mina,
  Poseidon,
  PrivateKey,
  PublicKey,
} from 'o1js';

let proofsEnabled = false;

const expectErorr = async (func: () => void): Promise<void> => {
  let gotError = false;

  try {
    await func();
  } catch (e) {
    gotError = true;
  }

  if (!gotError) {
    throw 'Expected error';
  }
};

describe('AccountManager.js', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    administrator: PublicKey,
    administratorPrivateKey: PrivateKey,
    spy1: PublicKey,
    spy1PrivateKey: PrivateKey,
    spy2: PublicKey,
    spy2PrivateKey: PrivateKey,
    notSpy1: PublicKey,
    notSpyPrivateKey: PrivateKey,
    accountManager: AccountManager;
  describe('AccountManager()', () => {
    beforeEach(() => {
      const Local = Mina.LocalBlockchain({ proofsEnabled });
      Mina.setActiveInstance(Local);
      ({ privateKey: deployerKey, publicKey: deployerAccount } =
        Local.testAccounts[0]);
      ({ privateKey: senderKey, publicKey: senderAccount } =
        Local.testAccounts[1]);
      ({ privateKey: administratorPrivateKey, publicKey: administrator } =
        Local.testAccounts[2]);
      ({ privateKey: spy1PrivateKey, publicKey: spy1 } = Local.testAccounts[3]);
      ({ privateKey: spy2PrivateKey, publicKey: spy2 } = Local.testAccounts[4]);
      ({ privateKey: notSpyPrivateKey, publicKey: notSpy1 } =
        Local.testAccounts[5]);
      zkAppPrivateKey = PrivateKey.random();
      zkAppAddress = zkAppPrivateKey.toPublicKey();
      accountManager = new AccountManager(zkAppAddress);
    });

    async function localDeploy() {
      const txn = await Mina.transaction(deployerAccount, () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        accountManager.deploy();
      });
      await txn.prove();
      // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
      await txn.sign([deployerKey, zkAppPrivateKey]).send();
    }

    it('list creation', async () => {
      await localDeploy();

      let merkleMap = new MerkleMap();

      // Set administrator
      const tx1 = await Mina.transaction(senderAccount, () => {
        accountManager.setAdministrator(administrator);
      });
      await tx1.prove();
      await tx1.sign([senderKey]).send();

      const tx2 = await Mina.transaction(administrator, () => {
        accountManager.addAccount(
          spy1,
          merkleMap.getWitness(Poseidon.hash(spy1.toFields()))
        );
      });

      await tx2.prove();
      await tx2.sign([administratorPrivateKey]).send();
      merkleMap.set(Poseidon.hash(spy1.toFields()), SpyState.listed().hash());

      /// Check for wrong addAccount
      expectErorr(async () => {
        await Mina.transaction(spy2, () => {
          accountManager.addAccount(
            spy2,
            merkleMap.getWitness(Poseidon.hash(spy1.toFields()))
          );
        });
      });

      /// Check for second addAccount
      const tx3 = await Mina.transaction(administrator, () => {
        accountManager.addAccount(
          spy2,
          merkleMap.getWitness(Poseidon.hash(spy2.toFields()))
        );
      });

      await tx3.prove();
      await tx3.sign([administratorPrivateKey]).send();
      merkleMap.set(Poseidon.hash(spy2.toFields()), SpyState.listed().hash());

      /// Check for messages addMessage
      let wrongMessage1 = Field.from(0b100001);
      let wrongMessage2 = Field.from(0b000010);
      let wrongMessage3 = Field.from(0b011000);

      await expectErorr(async () => {
        await Mina.transaction(spy1, () => {
          accountManager.addMessage(
            merkleMap.getWitness(Poseidon.hash(spy1.toFields())),
            wrongMessage1
          );
        });
      });

      await expectErorr(async () => {
        await Mina.transaction(spy1, () => {
          accountManager.addMessage(
            merkleMap.getWitness(Poseidon.hash(spy1.toFields())),
            wrongMessage2
          );
        });
      });

      await expectErorr(async () => {
        await Mina.transaction(spy1, () => {
          accountManager.addMessage(
            merkleMap.getWitness(Poseidon.hash(spy1.toFields())),
            wrongMessage3
          );
        });
      });

      let rightMessage1 = Field.from(0b000001);
      let rightMessage2 = Field.from(0b001110);

      await expectErorr(async () => {
        await Mina.transaction(notSpy1, () => {
          accountManager.addMessage(
            merkleMap.getWitness(Poseidon.hash(spy1.toFields())),
            rightMessage1
          );
        });
      });

      const tx4 = await Mina.transaction(spy1, () => {
        accountManager.addMessage(
          merkleMap.getWitness(Poseidon.hash(spy1.toFields())),
          rightMessage1
        );
      });

      await tx4.prove();
      await tx4.sign([spy1PrivateKey]).send();

      merkleMap.set(
        Poseidon.hash(spy1.toFields()),
        new SpyState({
          state: Field.from(AccountState.Participated),
          message: rightMessage1,
        }).hash()
      );

      const tx5 = await Mina.transaction(spy2, () => {
        accountManager.addMessage(
          merkleMap.getWitness(Poseidon.hash(spy2.toFields())),
          rightMessage1
        );
      });

      await tx5.prove();
      await tx5.sign([spy2PrivateKey]).send();

      merkleMap.set(
        Poseidon.hash(spy2.toFields()),
        new SpyState({
          state: Field.from(AccountState.Participated),
          message: rightMessage2,
        }).hash()
      );

      expect(accountManager.messageCount.get().toString()).toEqual('2');

      const events = await accountManager.fetchEvents();
      expect(events.length).toEqual(2);
      expect(events[0].event.data).toEqual(spy1);
      expect(events[1].event.data).toEqual(spy2);
    });
  });
});
