type RawBodyJsonResult = {
  body: string;
  headers: {
    "content-type": "application/json";
  };
};

export const rawBodyJson = (payload: unknown = {}): RawBodyJsonResult => ({
  body: JSON.stringify(payload),
  headers: {
    "content-type": "application/json",
  },
});
