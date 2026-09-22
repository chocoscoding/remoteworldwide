"use client";

// Every write to the user's contacts.
//
// The server owns the list (paging, counts, the hiring flag), so every write
// invalidates the whole `contacts` domain rather than patching a page in place:
// a save changes the counts on every filter chip, and an import changes all of
// it. Referral asks are written in NetworkProvider, beside the streak call.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiMessage } from "@/app/lib/api/core";
import { deleteContact, deleteContacts, importLinkedInConnections, saveContact } from "@/app/lib/contacts/api";
import type { ContactImportResult, ContactItem, ContactSource, SaveContactInput } from "@/app/lib/contacts/types";
import { qk } from "@/app/lib/query/keys";

function useContactWrite<V, R>(run: (vars: V) => Promise<R>, onDone?: (result: R, vars: V) => void, { toastErrors = true } = {}) {
  const queryClient = useQueryClient();
  return useMutation<R, unknown, V>({
    mutationFn: run,
    onSuccess: (result, vars) => {
      void queryClient.invalidateQueries({ queryKey: qk.contacts.all });
      onDone?.(result, vars);
    },
    onError: (error) => {
      if (toastErrors) toast.error(apiMessage(error));
    },
  });
}

/**
 * LinkedIn's Connections.csv. No error toast: the import dialog shows the
 * failure in place, where the instructions for getting the right file are.
 */
export const useImportLinkedInContacts = () =>
  useContactWrite<File, ContactImportResult>((file) => importLinkedInConnections(file), undefined, { toastErrors: false });

/** Save someone found online, or add someone by hand. Idempotent server-side. */
export const useSaveContact = () =>
  useContactWrite<SaveContactInput, ContactItem>(saveContact, (contact, vars) =>
    toast.success(vars.source === "web" ? `${contact.name} saved to your contacts` : `${contact.name} added`),
  );

export const useDeleteContact = () =>
  useContactWrite<{ id: string; name: string }, { deleted: true }>(({ id }) => deleteContact(id), (_r, { name }) => toast.success(`Removed ${name}`));

export const useDeleteContacts = () =>
  useContactWrite<ContactSource | undefined, { deleted: number }>(
    (source) => deleteContacts(source),
    ({ deleted }) => toast.success(deleted === 1 ? "Removed 1 contact" : `Removed ${deleted.toLocaleString()} contacts`),
  );
