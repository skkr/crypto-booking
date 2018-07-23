const mongoose = require('mongoose');
const BookingModel = mongoose.model('Booking');
const { utils } = require('web3');
const { handleApplicationError } = require('../errors');
const { toPlainObject } = require('../utils/classHelper');

class Booking {
  constructor ({ _id, publicKey, guestEthAddress, payment, signatureTimestamp, personalInfo, roomType, nights }) {
    this.id = _id;
    this.publicKey = publicKey;
    this.guestEthAddress = guestEthAddress;
    this._payment = payment || {};
    this._signatureTimestamp = signatureTimestamp;
    this.personalInfo = personalInfo;
    this.roomType = roomType;
    this.nights = nights;
  }

  get paymentTx () {
    return this._payment.tx;
  }

  set paymentTx (tx) {
    this._payment.tx = tx;
  }

  get paymentType () {
    return this._payment.type;
  }

  set paymentType (type) {
    this._payment.type = type;
  }

  get paymentAmount () {
    return this._payment.amount;
  }

  set paymentAmount (amount) {
    // TODO get the ETH price and set the value of amount * eth price
    this._payment.amount = amount;
  }

  get signatureTimestamp () {
    if (!this._signatureTimestamp) return null;
    return Math.round(this._signatureTimestamp.getTime() / 1000);
  }

  get personalInfo () {
    let decoded = utils.hexToString(this._personalInfo);
    return JSON.parse(decoded);
  }

  set personalInfo (value) {
    if (!value) {
      return;
    }
    if (utils.isHex(value)) {
      this._personalInfo = value;
      return null;
    }
    value = JSON.stringify(value);
    this._personalInfo = utils.stringToHex(value);
  }

  /**
  * Saves the current booking
  */
  async save () {
    try {
      if (!this.id) {
        const dbModel = await BookingModel.create({
          publicKey: this.publicKey,
          guestEthAddress: this.guestEthAddress,
          payment: this._payment,
          personalInfo: this._personalInfo,
          nights: this.nights,
          roomType: this.roomType,
        });
        this._signatureTimestamp = dbModel.signatureTimestamp;
        this.id = dbModel.id;

        return null;
      }
      await BookingModel.update({ _id: this.id },
        {
          $set: {
            publicKey: this.publicKey,
            guestEthAddress: this.guestEthAddress,
            payment: this._payment,
            personalInfo: this._personalInfo,
            nights: this.nights,
            roomType: this.roomType,
          },
        }).exec();
    } catch (e) {
      if (!e.errors) {
        if (e.code === 11000) {
          throw handleApplicationError('duplicateBooking');
        }
        throw handleApplicationError(e);
      }
      const firstKeyError = Object.keys(e.errors)[0];
      const firstError = e.errors[firstKeyError];
      switch (firstError.name) {
      case 'CastError':
      // TODO Add more cast errors
        if (firstError.path === 'payment.amount') {
          throw handleApplicationError('invalidPaymentAmount');
        }
        break;
      default:
        throw handleApplicationError(firstError.message);
      }
    }
  }

  /**
  * Deletes the current booking
  */
  delete () {
    return BookingModel.remove({ _id: this.id }).exec();
  }

  toPlainObject () {
    return toPlainObject(this);
  }
  /**
  * Creates a new Booking in the db and returns an instance of Booking
  * @param {Object} {publicKey, guestEthAddress, payment, personalInfo}
  * @return {Booking}
  */
  static async create (data) {
    const booking = new Booking(data);
    booking.paymentAmount = data.paymentAmount;
    booking.paymentType = data.paymentType;
    await booking.save();
    return booking;
  }

  /**
  * Finds the booking in the bd and returns an instance of Booking
  * @param {Object} {id: <Booking_id>}
  * @return {Booking || null}
  */
  static async read (filter) {
    if (mongoose.Types.ObjectId.isValid(filter.id)) {
      const rawData = await BookingModel.findById(filter.id).exec();
      if (!rawData) return null;
      return new Booking(rawData);
    }
    return null;
  }
}

module.exports = { Booking };
