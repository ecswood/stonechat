const IsBlockedNumber = (
  rawNumber: string,
  blockedNumbersSetting?: string | null
): boolean => {
  if (!blockedNumbersSetting) {
    return false;
  }

  const blocked = blockedNumbersSetting
    .split(",")
    .map(n => n.replace(/\D/g, ""))
    .filter(n => n.length > 0);

  return blocked.includes(rawNumber);
};

export default IsBlockedNumber;
